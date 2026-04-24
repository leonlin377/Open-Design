import {
  ArtifactGenerationDiagnosticsSchema,
  ArtifactGenerationDesignSystemSchema,
  ArtifactGenerationPlanSchema,
  type ApiError,
  type ArtifactGenerationDesignSystem,
  type ArtifactGenerationPlan,
  type ArtifactGenerationDiagnostics,
  type ArtifactKind,
  type ArtifactSceneTemplateKind,
  type DesignSystemPack,
  type PrototypeSceneTemplateKind,
  type SceneTemplateKind,
  type SlidesSceneTemplateKind
} from "@opendesign/contracts";
import { generateText } from "ai";
import { createLLMClient } from "./llm-client";
import { format } from "prettier";

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
  designSystem?: ArtifactGenerationDesignSystem;
  env?: NodeJS.ProcessEnv;
  /**
   * External abort signal. When aborted by a caller (e.g. a cancel request),
   * the upstream LiteLLM fetch is cancelled and the resulting error is mapped
   * to `GENERATION_CANCELLED` rather than `GENERATION_TIMEOUT`.
   */
  signal?: AbortSignal;
};

function buildHeuristicWebsiteSections(prompt: string): SceneTemplateKind[] {
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

function buildHeuristicPrototypeSections(): PrototypeSceneTemplateKind[] {
  // Prototype heuristic: produce a minimal flow of two screens wired by a
  // transition and closed by a decision CTA. Exporters use `screen-link`
  // transitions to emit the flow graph.
  return ["screen", "screen-link", "screen-cta"];
}

function buildHeuristicSlidesSections(prompt: string): SlidesSceneTemplateKind[] {
  // Slides heuristic: always open with a title and close on a takeaway. If
  // the prompt mentions structured data (metric/progress/roadmap/summary),
  // interleave an extra content slide so the deck carries a body beat.
  const value = prompt.toLowerCase();
  const sections: SlidesSceneTemplateKind[] = ["slide-title", "slide-content"];

  if (
    value.includes("metric") ||
    value.includes("progress") ||
    value.includes("roadmap") ||
    value.includes("summary") ||
    value.includes("update")
  ) {
    sections.push("slide-content");
  }

  sections.push("slide-closing");
  return sections;
}

function buildHeuristicSections(
  artifactKind: ArtifactKind,
  prompt: string
): ArtifactSceneTemplateKind[] {
  switch (artifactKind) {
    case "prototype":
      return buildHeuristicPrototypeSections();
    case "slides":
      return buildHeuristicSlidesSections(prompt);
    case "website":
    default:
      return buildHeuristicWebsiteSections(prompt);
  }
}

function buildHeuristicPlan(input: GenerateArtifactPlanInput): ArtifactGenerationPlan {
  const sections = buildHeuristicSections(input.artifactKind, input.prompt);
  const baseIntent = `Generate a ${input.artifactKind} artifact for ${input.artifactName}: ${input.prompt}`;
  const designSystemSuffix = input.designSystem
    ? ` Ground the artifact in the ${input.designSystem.name} design system using motifs ${input.designSystem.motifLabels.join(", ") || "none"}.`
    : "";

  return ArtifactGenerationPlanSchema.parse({
    prompt: input.prompt,
    intent: `${baseIntent}${designSystemSuffix}`,
    rationale: `${
      input.designSystem
        ? `Use the ${input.designSystem.name} pack as a grounding constraint. `
        : ""
    }Fallback heuristic plan selected a narrative opener, supporting structure, and closing action lane.`,
    sections,
    provider: "heuristic",
    ...(input.designSystem
      ? {
          designSystem: input.designSystem
        }
      : {})
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

async function generatePlanViaLiteLLM(
  input: GenerateArtifactPlanInput,
  env: NodeJS.ProcessEnv
): Promise<ArtifactPlanGenerationResult> {
  const client = createLLMClient(env);
  const model = env.OPENDESIGN_GENERATION_MODEL;

  if (!client || !model) {
    throw new ArtifactGenerationError({
      message: "Generation provider is not configured.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm", configured: false }
    });
  }

  let text: string;
  try {
    const result = await generateText({
      model: client(model),
      system:
        "You are generating a compact artifact plan. Return JSON only with keys: prompt, intent, rationale, sections, provider. designSystem is optional. sections must be an array using only hero, feature-grid, cta.",
      prompt: JSON.stringify({
        artifactKind: input.artifactKind,
        artifactName: input.artifactName,
        prompt: input.prompt,
        designSystem: input.designSystem ?? null
      }),
      temperature: 0.2,
      abortSignal: input.signal,
      maxRetries: 1,
    });
    text = result.text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ArtifactGenerationError({
        message: "Generation was cancelled.",
        code: "GENERATION_CANCELLED",
        details: { provider: "litellm" }
      });
    }
    throw new ArtifactGenerationError({
      message: "Generation provider request failed.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm" }
    });
  }

  if (!text) {
    throw new ArtifactGenerationError({
      message: "Generation provider returned an empty response.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm" }
    });
  }

  try {
    const stripped = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    if (Array.isArray(parsed.sections)) {
      parsed.sections = (parsed.sections as unknown[]).map((s) =>
        typeof s === "string" ? s : (s as Record<string, unknown>).type ?? s
      );
    }
    return {
      plan: ArtifactGenerationPlanSchema.parse({
        ...parsed,
        prompt: input.prompt,
        provider: "litellm",
        ...(input.designSystem ? { designSystem: input.designSystem } : {})
      }),
      diagnostics: ArtifactGenerationDiagnosticsSchema.parse({
        provider: "litellm",
        transport: "json",
        warning: null
      })
    };
  } catch {
    throw new ArtifactGenerationError({
      message: "Generation provider returned an invalid artifact plan.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm" }
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
    // Even the heuristic path respects an external cancel — a caller that
    // already aborted shouldn't receive a synthetic plan.
    if (input.signal?.aborted) {
      throw new ArtifactGenerationError({
        message: "Generation was cancelled before the heuristic planner ran.",
        code: "GENERATION_CANCELLED",
        details: {
          provider: "heuristic"
        }
      });
    }
    return buildHeuristicResult(input, fallbackReason);
  }

  return generatePlanViaLiteLLM(input, env);
}

export type FreeformCodeGenerationResult = {
  files: Record<string, string>;
  intent: string;
  rationale: string;
  diagnostics: ArtifactGenerationDiagnostics;
};

type GenerateFreeformCodeInput = {
  artifactKind: ArtifactKind;
  artifactName: string;
  prompt: string;
  designSystem?: ArtifactGenerationDesignSystem;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
};

const FREEFORM_SYSTEM_PROMPT = `You are an expert UI designer and React developer. Generate a complete, production-quality React component based on the user's description.

REQUIREMENTS:
1. Output a single, self-contained App.tsx component using \`export default function App()\`
2. Use Tailwind CSS utility classes for ALL styling — no inline styles, no CSS files, no styled-components
3. The component must be completely self-contained with no external dependencies beyond React
4. Use real, meaningful placeholder content — never use "Lorem ipsum" or generic text
5. Implement responsive design using Tailwind's responsive prefixes (sm:, md:, lg:, xl:)
6. Use a modern typography hierarchy: display text 48-96px, headings 28-40px, body 16-18px, captions 12-14px
7. Include hover states and micro-interactions using Tailwind's hover:, focus:, transition classes
8. Use semantic HTML elements (header, main, section, nav, footer, article)
9. For images, use colored gradient div placeholders or inline SVG — never use external image URLs
10. Use a cohesive color palette with Tailwind's color system (slate, zinc, stone, neutral, or custom colors)
11. Include proper spacing rhythm using Tailwind's spacing scale
12. Ensure accessibility: proper heading hierarchy, alt text, ARIA labels where needed

CRITICAL FORMATTING RULES:
- Output properly formatted, human-readable, multi-line code with 2-space indentation
- NEVER minify, compress, or put everything on one line
- Every JSX element, every object property, and every statement must be on its own line
- The code must be syntactically valid TypeScript JSX — double-check all commas, brackets, and parentheses
- Keep the component under 200 lines to stay within Sandpack's rendering budget

OUTPUT FORMAT:
Wrap your complete component code in a single \`\`\`tsx code block. Output ONLY the code block, no explanations.`;

function extractFreeformCode(raw: string): string | null {
  if (!raw) {
    return null;
  }

  const fenceMatch = raw.match(/```(?:tsx|jsx|ts|js|typescript|javascript)?\s*\n?([\s\S]*?)```/i);
  let candidate = fenceMatch ? fenceMatch[1] : raw;
  candidate = candidate
    .replace(/^```(?:tsx|jsx|ts|js|typescript|javascript)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
  const trimmed = candidate.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes("export default")) {
    return null;
  }

  return trimmed;
}

function buildHeuristicFreeformCode(input: GenerateFreeformCodeInput): string {
  const safeName = input.artifactName.replace(/`/g, "'");
  const safePrompt = input.prompt.replace(/`/g, "'");

  return `export default function App() {
  const features = [
    {
      title: "Thoughtful Craft",
      description: "Every surface considered, every interaction refined for a sense of quiet confidence."
    },
    {
      title: "Grounded Systems",
      description: "A cohesive palette, deliberate typography, and consistent spacing rhythm across the product."
    },
    {
      title: "Ready to Ship",
      description: "Self-contained React and Tailwind output, prepared for direct handoff into any workflow."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <header className="container mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold text-white mb-4">${safeName}</h1>
        <p className="text-xl text-slate-300 max-w-2xl">${safePrompt}</p>
      </header>
      <main className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 transition hover:border-slate-500 hover:bg-slate-900"
            >
              <h2 className="text-2xl font-semibold text-white mb-3">{feature.title}</h2>
              <p className="text-base text-slate-300 leading-relaxed">{feature.description}</p>
            </article>
          ))}
        </div>
      </main>
      <footer className="container mx-auto px-6 py-8 border-t border-slate-700">
        <p className="text-slate-400">Built with OpenDesign</p>
      </footer>
    </div>
  );
}
`;
}

function buildHeuristicFreeformResult(
  input: GenerateFreeformCodeInput,
  warning: string
): FreeformCodeGenerationResult {
  const code = buildHeuristicFreeformCode(input);
  const designSystemSuffix = input.designSystem
    ? ` Ground the artifact in the ${input.designSystem.name} design system using motifs ${input.designSystem.motifLabels.join(", ") || "none"}.`
    : "";

  return {
    files: {
      "/App.tsx": code
    },
    intent: `Generate a freeform ${input.artifactKind} artifact for ${input.artifactName}: ${input.prompt}${designSystemSuffix}`,
    rationale:
      "Fallback heuristic generator produced a structured hero, three feature cards, and footer using Tailwind CSS.",
    diagnostics: ArtifactGenerationDiagnosticsSchema.parse({
      provider: "heuristic",
      transport: "fallback",
      warning
    })
  };
}

async function generateFreeformCodeViaLiteLLM(
  input: GenerateFreeformCodeInput,
  env: NodeJS.ProcessEnv
): Promise<FreeformCodeGenerationResult> {
  const client = createLLMClient(env);
  const model = env.OPENDESIGN_GENERATION_MODEL;

  if (!client || !model) {
    throw new ArtifactGenerationError({
      message: "Generation provider is not configured.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm", configured: false }
    });
  }

  let text: string;
  try {
    const result = await generateText({
      model: client(model),
      system: FREEFORM_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        artifactKind: input.artifactKind,
        artifactName: input.artifactName,
        prompt: input.prompt,
        designSystem: input.designSystem ?? null
      }),
      temperature: 0.6,
      abortSignal: input.signal,
      maxRetries: 1,
    });
    text = result.text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ArtifactGenerationError({
        message: "Generation was cancelled.",
        code: "GENERATION_CANCELLED",
        details: { provider: "litellm" }
      });
    }
    throw new ArtifactGenerationError({
      message: "Generation provider request failed.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm" }
    });
  }

  if (!text) {
    throw new ArtifactGenerationError({
      message: "Generation provider returned an empty response.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm" }
    });
  }

  const code = extractFreeformCode(text);
  if (!code) {
    throw new ArtifactGenerationError({
      message: "Generation provider returned freeform output without a valid code block.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm" }
    });
  }

  // Prettier formats the code — fixes any whitespace issues from the proxy
  let formatted: string;
  try {
    formatted = await format(code, {
      parser: "typescript",
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      printWidth: 100,
    });
  } catch {
    // If Prettier can't parse it, the code has real syntax errors — fall back
    throw new ArtifactGenerationError({
      message: "Generated code has syntax errors that could not be auto-fixed.",
      code: "INVALID_GENERATION_PLAN",
      details: { provider: "litellm" }
    });
  }

  const designSystemSuffix = input.designSystem
    ? ` Grounded in the ${input.designSystem.name} design system.`
    : "";

  return {
    files: { "/App.tsx": formatted },
    intent: `Generate a freeform ${input.artifactKind} artifact for ${input.artifactName}: ${input.prompt}${designSystemSuffix}`,
    rationale:
      "LiteLLM freeform generator produced a self-contained React + Tailwind component tailored to the prompt.",
    diagnostics: ArtifactGenerationDiagnosticsSchema.parse({
      provider: "litellm",
      transport: "json",
      warning: null
    })
  };
}

export async function generateFreeformCode(
  input: GenerateFreeformCodeInput
): Promise<FreeformCodeGenerationResult> {
  const env = input.env ?? process.env;
  const fallbackReason =
    !env.LITELLM_API_BASE_URL && !env.OPENAI_API_BASE_URL
      ? "LiteLLM gateway is not configured, so freeform generation fell back to the local heuristic generator."
      : !env.OPENDESIGN_GENERATION_MODEL
        ? "No generation model is configured, so freeform generation fell back to the local heuristic generator."
        : null;

  if (fallbackReason) {
    if (input.signal?.aborted) {
      throw new ArtifactGenerationError({
        message: "Generation was cancelled before the heuristic freeform generator ran.",
        code: "GENERATION_CANCELLED",
        details: {
          provider: "heuristic"
        }
      });
    }
    return buildHeuristicFreeformResult(input, fallbackReason);
  }

  try {
    return await generateFreeformCodeViaLiteLLM(input, env);
  } catch (error) {
    // Cancellation and timeout should propagate — the user expects those.
    if (
      error instanceof ArtifactGenerationError &&
      (error.code === "GENERATION_CANCELLED" || error.code === "GENERATION_TIMEOUT")
    ) {
      throw error;
    }
    // For invalid/corrupt LLM output, fall back to the heuristic generator
    // so the user still gets a working preview.
    return buildHeuristicFreeformResult(
      input,
      "LLM returned unusable code (possibly minified or malformed), so generation fell back to the local heuristic generator."
    );
  }
}

export function summarizeDesignSystemForGeneration(
  pack: DesignSystemPack
): ArtifactGenerationDesignSystem {
  return ArtifactGenerationDesignSystemSchema.parse({
    id: pack.id,
    name: pack.name,
    source: pack.source,
    motifLabels: pack.motifs.map((motif) => motif.label).slice(0, 6),
    colorTokenCount: Object.keys(pack.tokens.colors).length,
    typographyTokenCount: Object.keys(pack.tokens.typography).length,
    componentCount: pack.components.length
  });
}
