import {
  ArtifactGenerationDiagnosticsSchema,
  ArtifactGenerationPlanSchema,
  type ApiError,
  type ArtifactGenerationPlan,
  type ArtifactGenerationDiagnostics,
  type ArtifactKind,
  type SceneTemplateKind
} from "@opendesign/contracts";

export type ArtifactPlanGenerationResult = {
  plan: ArtifactGenerationPlan;
  diagnostics: ArtifactGenerationDiagnostics;
};

export class ArtifactGenerationError extends Error {
  code: ApiError["code"];
  recoverable: boolean;
  details?: Record<string, unknown>;

  constructor(input: {
    message: string;
    code: ApiError["code"];
    recoverable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "ArtifactGenerationError";
    this.code = input.code;
    this.recoverable = input.recoverable ?? true;
    this.details = input.details;
  }
}

type GenerateArtifactPlanInput = {
  artifactKind: ArtifactKind;
  artifactName: string;
  prompt: string;
  env?: NodeJS.ProcessEnv;
};

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildHeuristicSections(prompt: string): SceneTemplateKind[] {
  const value = prompt.toLowerCase();
  const sections: SceneTemplateKind[] = ["hero"];

  if (
    value.includes("feature") ||
    value.includes("pricing") ||
    value.includes("benefit") ||
    value.includes("workflow") ||
    value.includes("capability")
  ) {
    sections.push("feature-grid");
  }

  if (
    value.includes("cta") ||
    value.includes("contact") ||
    value.includes("signup") ||
    value.includes("demo") ||
    value.includes("launch")
  ) {
    sections.push("cta");
  }

  if (!sections.includes("feature-grid")) {
    sections.push("feature-grid");
  }

  if (!sections.includes("cta")) {
    sections.push("cta");
  }

  return sections;
}

function buildHeuristicPlan(input: GenerateArtifactPlanInput): ArtifactGenerationPlan {
  const sections = buildHeuristicSections(input.prompt);

  return ArtifactGenerationPlanSchema.parse({
    prompt: input.prompt,
    intent: `Generate a ${input.artifactKind} artifact for ${input.artifactName}: ${input.prompt}`,
    rationale:
      "Fallback heuristic plan selected a narrative opener, supporting structure, and closing action lane.",
    sections,
    provider: "heuristic"
  });
}

function buildHeuristicResult(
  input: GenerateArtifactPlanInput,
  warning: string
): ArtifactPlanGenerationResult {
  return {
    plan: buildHeuristicPlan(input),
    diagnostics: ArtifactGenerationDiagnosticsSchema.parse({
      provider: "heuristic",
      transport: "fallback",
      warning
    })
  };
}

function readTimeoutMs(env: NodeJS.ProcessEnv) {
  const value = Number(env.OPENDESIGN_GENERATION_TIMEOUT_MS ?? "15000");
  return Number.isFinite(value) && value > 0 ? value : 15000;
}

function readStreamDeltaContent(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (typeof entry !== "object" || entry === null) {
        return "";
      }

      if ("text" in entry && typeof entry.text === "string") {
        return entry.text;
      }

      return "";
    })
    .join("");
}

async function readChatCompletionStream(response: Response) {
  if (!response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const payload = trimmed.slice(5).trim();

      if (!payload || payload === "[DONE]") {
        continue;
      }

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: unknown;
            };
          }>;
        };
        const delta = readStreamDeltaContent(parsed.choices?.[0]?.delta?.content);

        if (delta) {
          content += delta;
        }
      } catch {
        return null;
      }
    }

    if (done) {
      break;
    }
  }

  return content.trim() ? content : null;
}

async function readChatCompletionJson(response: Response) {
  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || null;
}

async function generatePlanViaLiteLLM(
  input: GenerateArtifactPlanInput,
  env: NodeJS.ProcessEnv
): Promise<ArtifactPlanGenerationResult> {
  const baseUrl = env.LITELLM_API_BASE_URL ?? env.OPENAI_API_BASE_URL;
  const model = env.OPENDESIGN_GENERATION_MODEL;

  if (!baseUrl || !model) {
    throw new ArtifactGenerationError({
      message: "Generation provider is not configured.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: {
        provider: "litellm",
        configured: false
      }
    });
  }

  const apiKey =
    env.LITELLM_MASTER_KEY ?? env.OPENAI_API_KEY ?? env.LITELLM_API_KEY ?? "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeoutMs(env));

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
        stream: true,
        temperature: 0.2,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content:
              "You are generating a compact artifact plan. Return JSON only with keys: prompt, intent, rationale, sections, provider. sections must be an array using only hero, feature-grid, cta."
          },
          {
            role: "user",
            content: JSON.stringify({
              artifactKind: input.artifactKind,
              artifactName: input.artifactName,
              prompt: input.prompt
            })
          }
        ]
      })
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ArtifactGenerationError({
        message: "Generation timed out while waiting for the model gateway.",
        code: "GENERATION_TIMEOUT",
        details: {
          provider: "litellm"
        }
      });
    }

    throw new ArtifactGenerationError({
      message: "Generation provider request failed before a response was received.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: {
        provider: "litellm"
      }
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ArtifactGenerationError({
      message: "Generation provider returned an unsuccessful response.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: {
        provider: "litellm",
        status: response.status
      }
    });
  }
  const contentType = response.headers.get("content-type") ?? "";
  const content = contentType.includes("text/event-stream")
    ? await readChatCompletionStream(response)
    : await readChatCompletionJson(response);

  if (!content) {
    throw new ArtifactGenerationError({
      message: "Generation provider returned an empty response.",
      code: "INVALID_GENERATION_PLAN",
      details: {
        provider: "litellm",
        transport: contentType.includes("text/event-stream") ? "stream" : "json"
      }
    });
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      plan: ArtifactGenerationPlanSchema.parse({
        ...parsed,
        prompt: input.prompt,
        provider: "litellm"
      }),
      diagnostics: ArtifactGenerationDiagnosticsSchema.parse({
        provider: "litellm",
        transport: contentType.includes("text/event-stream") ? "stream" : "json",
        warning: null
      })
    };
  } catch {
    throw new ArtifactGenerationError({
      message: "Generation provider returned an invalid artifact plan.",
      code: "INVALID_GENERATION_PLAN",
      details: {
        provider: "litellm",
        transport: contentType.includes("text/event-stream") ? "stream" : "json"
      }
    });
  }
}

export async function generateArtifactPlan(
  input: GenerateArtifactPlanInput
): Promise<ArtifactPlanGenerationResult> {
  const env = input.env ?? process.env;
  const fallbackReason =
    !env.LITELLM_API_BASE_URL && !env.OPENAI_API_BASE_URL
      ? "LiteLLM gateway is not configured, so generation fell back to the local heuristic planner."
      : !env.OPENDESIGN_GENERATION_MODEL
        ? "No generation model is configured, so generation fell back to the local heuristic planner."
        : null;

  if (fallbackReason) {
    return buildHeuristicResult(input, fallbackReason);
  }

  return generatePlanViaLiteLLM(input, env);
}
