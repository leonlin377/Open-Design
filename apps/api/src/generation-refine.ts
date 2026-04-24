import type { SceneNode } from "@opendesign/contracts";
import { ArtifactGenerationError } from "./generation";

export interface RefineNodeInput {
  node: SceneNode;
  instruction: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

export interface RefineNodeResult {
  /**
   * Prop delta to merge into the targeted node. The caller is responsible for
   * running this through `updateRootSceneNode` so existing scene-node update
   * semantics (shallow prop merge, version bump) are preserved.
   */
  propDelta: Record<string, unknown>;
  /** Optional new display name for the node. */
  name?: string;
  /** Short human-readable rationale surfaced to the UI. */
  rationale: string;
  provider: "litellm" | "heuristic";
  warning: string | null;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function readTimeoutMs(env: NodeJS.ProcessEnv) {
  const value = Number(env.OPENDESIGN_GENERATION_TIMEOUT_MS ?? "15000");
  return Number.isFinite(value) && value > 0 ? value : 15000;
}

/**
 * Heuristic prop delta. We derive a plausible delta from the instruction
 * text using simple keyword rules so the refine endpoint works without the
 * LiteLLM gateway configured. The goal is not to produce an arbitrarily
 * clever edit — it's to prove the update path round-trips and ships a
 * believable-looking scene node.
 */
export function buildHeuristicRefineDelta(input: {
  node: SceneNode;
  instruction: string;
}): RefineNodeResult {
  const instruction = input.instruction.trim();
  const lower = instruction.toLowerCase();
  const delta: Record<string, unknown> = {};
  const tones: string[] = [];

  if (lower.includes("bold") || lower.includes("stronger")) {
    tones.push("bolder");
  }
  if (lower.includes("minimal") || lower.includes("simpler")) {
    tones.push("more minimal");
  }
  if (lower.includes("playful") || lower.includes("fun")) {
    tones.push("more playful");
  }
  if (lower.includes("short") || lower.includes("concise")) {
    tones.push("tighter");
  }
  if (lower.includes("longer") || lower.includes("detailed")) {
    tones.push("more detailed");
  }

  const toneSuffix = tones.length > 0 ? ` (${tones.join(", ")})` : "";

  const existingHeadline =
    typeof input.node.props.headline === "string" ? input.node.props.headline : null;
  const existingBody =
    typeof input.node.props.body === "string" ? input.node.props.body : null;
  const existingEyebrow =
    typeof input.node.props.eyebrow === "string" ? input.node.props.eyebrow : null;
  const existingTitle =
    typeof input.node.props.title === "string" ? input.node.props.title : null;
  const existingPrimary =
    typeof input.node.props.primaryAction === "string"
      ? input.node.props.primaryAction
      : null;

  if (existingHeadline) {
    delta.headline = `${existingHeadline}${toneSuffix}`.slice(0, 240);
  }
  if (existingBody) {
    // Fold the instruction intent into the body so the change is obvious on
    // the preview without replacing the original narrative wholesale.
    delta.body = `${existingBody} — refined per instruction: ${instruction}`.slice(
      0,
      600
    );
  }
  if (!existingHeadline && !existingBody) {
    // Fallback for CTA / link / title-only nodes — keep it minimal but
    // visibly refined.
    if (existingEyebrow) {
      delta.eyebrow = `${existingEyebrow}${toneSuffix}`.slice(0, 120);
    } else if (existingTitle) {
      delta.title = `${existingTitle}${toneSuffix}`.slice(0, 180);
    } else if (existingPrimary) {
      delta.primaryAction = `${existingPrimary}${toneSuffix}`.slice(0, 80);
    }
  }

  // Guarantee a non-empty delta so callers never have to special-case "no
  // rule fired": we always record the refined instruction on the eyebrow
  // field as a tiebreaker.
  if (Object.keys(delta).length === 0) {
    delta.eyebrow = `Refined: ${instruction}`.slice(0, 120);
  }

  return {
    propDelta: delta,
    rationale: `Heuristic refine applied${toneSuffix || ""}.`,
    provider: "heuristic",
    warning:
      "Refine provider fell back to the local heuristic — OPENDESIGN_REFINE_MODEL not configured."
  };
}

interface LiteLLMRefinePayload {
  headline?: string;
  body?: string;
  eyebrow?: string;
  title?: string;
  primaryAction?: string;
  secondaryAction?: string;
  name?: string;
  rationale?: string;
}

export async function refineNode(input: RefineNodeInput): Promise<RefineNodeResult> {
  const env = input.env ?? process.env;
  const baseUrl = env.LITELLM_API_BASE_URL ?? env.OPENAI_API_BASE_URL;
  const model = env.OPENDESIGN_REFINE_MODEL;

  if (!baseUrl || !model) {
    if (input.signal?.aborted) {
      throw new ArtifactGenerationError({
        message: "Refine was cancelled before the heuristic planner ran.",
        code: "GENERATION_CANCELLED",
        details: { stage: "refine" }
      });
    }
    return buildHeuristicRefineDelta({
      node: input.node,
      instruction: input.instruction
    });
  }

  const apiKey =
    env.LITELLM_MASTER_KEY ?? env.OPENAI_API_KEY ?? env.LITELLM_API_KEY ?? "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeoutMs(env));

  let externallyAborted = false;
  const externalSignal = input.signal;
  const onExternalAbort = () => {
    externallyAborted = true;
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      externallyAborted = true;
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  let response: Response;

  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are refining a single scene node. Return JSON only with keys drawn from: headline, body, eyebrow, title, primaryAction, secondaryAction, name, rationale. Omit keys you do not want to change."
          },
          {
            role: "user",
            content: JSON.stringify({
              node: {
                id: input.node.id,
                type: input.node.type,
                name: input.node.name,
                props: input.node.props
              },
              instruction: input.instruction
            })
          }
        ]
      })
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (externallyAborted) {
        throw new ArtifactGenerationError({
          message: "Refine was cancelled before the model gateway responded.",
          code: "GENERATION_CANCELLED",
          details: { provider: "litellm", stage: "refine" }
        });
      }
      throw new ArtifactGenerationError({
        message: "Refine timed out while waiting for the model gateway.",
        code: "GENERATION_TIMEOUT",
        details: { provider: "litellm", stage: "refine" }
      });
    }
    throw new ArtifactGenerationError({
      message: "Refine provider request failed before a response was received.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm", stage: "refine" }
    });
  } finally {
    clearTimeout(timeout);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  if (!response.ok) {
    throw new ArtifactGenerationError({
      message: "Refine provider returned an unsuccessful response.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm", stage: "refine", status: response.status }
    });
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new ArtifactGenerationError({
      message: "Refine provider returned an empty response.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm", stage: "refine" }
    });
  }

  let parsed: LiteLLMRefinePayload;
  try {
    const stripped = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    parsed = JSON.parse(stripped) as LiteLLMRefinePayload;
  } catch {
    throw new ArtifactGenerationError({
      message: "Refine provider returned an invalid JSON payload.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm", stage: "refine" }
    });
  }

  const delta: Record<string, unknown> = {};
  const allow: (keyof LiteLLMRefinePayload)[] = [
    "headline",
    "body",
    "eyebrow",
    "title",
    "primaryAction",
    "secondaryAction"
  ];
  for (const key of allow) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim().length > 0) {
      delta[key] = value;
    }
  }

  if (Object.keys(delta).length === 0 && typeof parsed.name !== "string") {
    throw new ArtifactGenerationError({
      message: "Refine provider returned no actionable delta.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm", stage: "refine" }
    });
  }

  return {
    propDelta: delta,
    ...(typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? { name: parsed.name }
      : {}),
    rationale:
      typeof parsed.rationale === "string" && parsed.rationale.trim().length > 0
        ? parsed.rationale
        : "Refined via LiteLLM gateway.",
    provider: "litellm",
    warning: null
  };
}

export interface RefineFreeformInput {
  currentCode: string;
  instruction: string;
  artifactName: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

export interface RefineFreeformResult {
  code: string;
  rationale: string;
  provider: "litellm" | "heuristic";
  warning: string | null;
}

function extractCodeFromResponse(content: string): string | null {
  const match = content.match(/```(?:tsx|jsx|typescript|javascript)?\s*\n([\s\S]*?)```/);
  return match?.[1]?.trim() ?? null;
}

function buildHeuristicFreeformRefine(input: {
  currentCode: string;
  instruction: string;
}): RefineFreeformResult {
  return {
    code: `// Refined: ${input.instruction}\n${input.currentCode}`,
    rationale: "Heuristic freeform refine prepended an instruction comment.",
    provider: "heuristic",
    warning:
      "Refine provider fell back to the local heuristic — OPENDESIGN_REFINE_MODEL not configured."
  };
}

export async function refineFreeformCode(
  input: RefineFreeformInput
): Promise<RefineFreeformResult> {
  const env = input.env ?? process.env;
  const baseUrl = env.LITELLM_API_BASE_URL ?? env.OPENAI_API_BASE_URL;
  const model = env.OPENDESIGN_REFINE_MODEL;

  if (!baseUrl || !model) {
    if (input.signal?.aborted) {
      throw new ArtifactGenerationError({
        message: "Refine was cancelled before the heuristic planner ran.",
        code: "GENERATION_CANCELLED",
        details: { stage: "refine" }
      });
    }
    return buildHeuristicFreeformRefine({
      currentCode: input.currentCode,
      instruction: input.instruction
    });
  }

  const apiKey =
    env.LITELLM_MASTER_KEY ?? env.OPENAI_API_KEY ?? env.LITELLM_API_KEY ?? "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeoutMs(env));

  let externallyAborted = false;
  const externalSignal = input.signal;
  const onExternalAbort = () => {
    externallyAborted = true;
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      externallyAborted = true;
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  let response: Response;

  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are refining an existing React component. The user will provide the current component code and a modification instruction. Apply the requested changes and return the complete updated component.\n\nRULES:\n1. Return the COMPLETE modified component — do not return partial code or diffs\n2. Preserve the overall structure and style unless the instruction specifically asks to change it\n3. Keep using Tailwind CSS utility classes for styling\n4. Maintain the export default function signature\n5. Wrap your code in a ```tsx code block"
          },
          {
            role: "user",
            content: JSON.stringify({
              currentCode: input.currentCode,
              instruction: input.instruction
            })
          }
        ]
      })
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (externallyAborted) {
        throw new ArtifactGenerationError({
          message: "Refine was cancelled before the model gateway responded.",
          code: "GENERATION_CANCELLED",
          details: { provider: "litellm", stage: "refine" }
        });
      }
      throw new ArtifactGenerationError({
        message: "Refine timed out while waiting for the model gateway.",
        code: "GENERATION_TIMEOUT",
        details: { provider: "litellm", stage: "refine" }
      });
    }
    throw new ArtifactGenerationError({
      message: "Refine provider request failed before a response was received.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm", stage: "refine" }
    });
  } finally {
    clearTimeout(timeout);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  if (!response.ok) {
    throw new ArtifactGenerationError({
      message: "Refine provider returned an unsuccessful response.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm", stage: "refine", status: response.status }
    });
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new ArtifactGenerationError({
      message: "Refine provider returned an empty response.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm", stage: "refine" }
    });
  }

  const extracted = extractCodeFromResponse(content);
  if (!extracted) {
    throw new ArtifactGenerationError({
      message: "Refine provider did not return a parsable code block.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm", stage: "refine" }
    });
  }

  return {
    code: extracted,
    rationale: `Refined freeform component for ${input.artifactName} via LiteLLM gateway.`,
    provider: "litellm",
    warning: null
  };
}
