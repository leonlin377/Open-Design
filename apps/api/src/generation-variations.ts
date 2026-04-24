import {
  ArtifactGenerationDiagnosticsSchema,
  ArtifactGenerationPlanSchema,
  type ArtifactGenerationDesignSystem,
  type ArtifactGenerationDiagnostics,
  type ArtifactGenerationPlan,
  type ArtifactKind,
  type ArtifactSceneTemplateKind,
  type PrototypeSceneTemplateKind,
  type SlidesSceneTemplateKind
} from "@opendesign/contracts";
import {
  generateArtifactPlan,
  generateFreeformCode,
  type ArtifactPlanGenerationResult
} from "./generation";

export interface VariationPlanResult {
  label: string;
  tone: string;
  result: ArtifactPlanGenerationResult;
}

export interface GenerateVariationPlansInput {
  artifactKind: ArtifactKind;
  artifactName: string;
  prompt: string;
  count: number;
  designSystem?: ArtifactGenerationDesignSystem;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

/**
 * Deterministic tone adjectives cycled across variations. Using a fixed list
 * keeps the heuristic output reproducible for tests and still produces
 * "obviously different" labels for the UI 3-up preview cards.
 */
const TONE_LABELS: readonly string[] = [
  "Bold",
  "Refined",
  "Playful",
  "Minimal",
  "Cinematic"
];

const WEBSITE_ROTATIONS: readonly ArtifactSceneTemplateKind[][] = [
  ["hero", "feature-grid", "cta"],
  ["hero", "cta", "feature-grid"],
  ["feature-grid", "hero", "cta"],
  ["hero", "feature-grid", "feature-grid", "cta"],
  ["hero", "cta"]
];

const PROTOTYPE_ROTATIONS: readonly PrototypeSceneTemplateKind[][] = [
  ["screen", "screen-link", "screen-cta"],
  ["screen", "screen-cta", "screen-link"],
  ["screen", "screen-link", "screen", "screen-cta"],
  ["screen", "screen-cta"],
  ["screen-cta", "screen-link", "screen"]
];

const SLIDES_ROTATIONS: readonly SlidesSceneTemplateKind[][] = [
  ["slide-title", "slide-content", "slide-closing"],
  ["slide-title", "slide-content", "slide-content", "slide-closing"],
  ["slide-title", "slide-closing", "slide-content"],
  ["slide-title", "slide-content"],
  ["slide-content", "slide-title", "slide-closing"]
];

function rotationsFor(kind: ArtifactKind): readonly ArtifactSceneTemplateKind[][] {
  switch (kind) {
    case "prototype":
      return PROTOTYPE_ROTATIONS;
    case "slides":
      return SLIDES_ROTATIONS;
    case "website":
    default:
      return WEBSITE_ROTATIONS;
  }
}

function buildHeuristicVariationPlan(
  input: Omit<GenerateVariationPlansInput, "count"> & { index: number; tone: string }
): ArtifactGenerationPlan {
  const rotations = rotationsFor(input.artifactKind);
  const sections = rotations[input.index % rotations.length]!;
  const baseIntent = `Generate a ${input.artifactKind} artifact for ${input.artifactName}: ${input.prompt}`;
  const toneSuffix = ` Tone: ${input.tone}.`;
  const designSystemSuffix = input.designSystem
    ? ` Ground the artifact in the ${input.designSystem.name} design system.`
    : "";

  return ArtifactGenerationPlanSchema.parse({
    prompt: input.prompt,
    intent: `${baseIntent}${toneSuffix}${designSystemSuffix}`,
    rationale: `Heuristic variation ${input.index + 1} rotates the section order with a ${input.tone.toLowerCase()} tone.`,
    sections,
    provider: "heuristic",
    ...(input.designSystem ? { designSystem: input.designSystem } : {})
  });
}

function buildHeuristicVariationDiagnostics(
  warning: string
): ArtifactGenerationDiagnostics {
  return ArtifactGenerationDiagnosticsSchema.parse({
    provider: "heuristic",
    transport: "fallback",
    warning
  });
}

/**
 * Produce N variation plans. If a LiteLLM gateway is configured we kick off
 * N parallel `generateArtifactPlan` passes; any individual failure falls back
 * to the heuristic rotation so the caller always gets N results. When no
 * gateway is configured we skip straight to the deterministic heuristic
 * generator.
 */
export async function generateVariationPlans(
  input: GenerateVariationPlansInput
): Promise<VariationPlanResult[]> {
  const env = input.env ?? process.env;
  const gatewayConfigured = Boolean(
    (env.LITELLM_API_BASE_URL ?? env.OPENAI_API_BASE_URL) &&
      env.OPENDESIGN_GENERATION_MODEL
  );
  const count = Math.max(1, Math.min(5, input.count));
  const indices = Array.from({ length: count }, (_, i) => i);

  if (!gatewayConfigured) {
    return indices.map((index) => {
      const tone = TONE_LABELS[index % TONE_LABELS.length]!;
      return {
        label: `Variation ${index + 1} — ${tone}`,
        tone,
        result: {
          plan: buildHeuristicVariationPlan({
            artifactKind: input.artifactKind,
            artifactName: input.artifactName,
            prompt: input.prompt,
            designSystem: input.designSystem,
            signal: input.signal,
            env,
            index,
            tone
          }),
          diagnostics: buildHeuristicVariationDiagnostics(
            "Variation planner fell back to the local heuristic — gateway not configured."
          )
        }
      };
    });
  }

  const passes = indices.map(async (index) => {
    const tone = TONE_LABELS[index % TONE_LABELS.length]!;
    try {
      const result = await generateArtifactPlan({
        artifactKind: input.artifactKind,
        artifactName: input.artifactName,
        // Bias each parallel pass with its tone adjective so the gateway
        // genuinely produces distinct plans.
        prompt: `${input.prompt} (variation ${index + 1}, ${tone.toLowerCase()} tone)`,
        ...(input.designSystem ? { designSystem: input.designSystem } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        env
      });
      return {
        label: `Variation ${index + 1} — ${tone}`,
        tone,
        result
      };
    } catch {
      return {
        label: `Variation ${index + 1} — ${tone}`,
        tone,
        result: {
          plan: buildHeuristicVariationPlan({
            artifactKind: input.artifactKind,
            artifactName: input.artifactName,
            prompt: input.prompt,
            designSystem: input.designSystem,
            signal: input.signal,
            env,
            index,
            tone
          }),
          diagnostics: buildHeuristicVariationDiagnostics(
            "Gateway variation pass failed — fell back to the local heuristic."
          )
        }
      };
    }
  });

  return Promise.all(passes);
}

export interface FreeformVariationResult {
  label: string;
  tone: string;
  code: string;
  intent: string;
  rationale: string;
  provider: "litellm" | "heuristic";
}

export interface GenerateFreeformVariationsInput {
  artifactKind: ArtifactKind;
  artifactName: string;
  prompt: string;
  count: number;
  designSystem?: ArtifactGenerationDesignSystem;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

function buildHeuristicFreeformVariationCode(tone: string, prompt: string): string {
  const safePrompt = prompt.replace(/`/g, "'").slice(0, 160);

  switch (tone) {
    case "Bold":
      return `export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-8 py-20">
      <section className="max-w-5xl mx-auto">
        <p className="text-amber-400 uppercase tracking-widest text-sm font-bold mb-6">Bold variation</p>
        <h1 className="text-7xl md:text-8xl font-black leading-none tracking-tight mb-8">${safePrompt}</h1>
        <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">A high-contrast bold take — dark surfaces, oversized typography, and accent highlights.</p>
        <button className="mt-10 bg-amber-400 text-slate-950 font-bold px-8 py-4 rounded hover:bg-amber-300 transition">Get started</button>
      </section>
    </main>
  );
}`;
    case "Refined":
      return `export default function App() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 px-8 py-24">
      <section className="max-w-4xl mx-auto">
        <p className="text-stone-500 tracking-wide text-sm mb-6">Refined variation</p>
        <h1 className="text-5xl md:text-6xl font-serif leading-tight mb-8">${safePrompt}</h1>
        <p className="text-lg text-stone-600 max-w-2xl leading-relaxed">An elegant and restrained variation — serif headings, soft shadows, and measured spacing.</p>
        <div className="mt-12 bg-white shadow-lg rounded-lg px-8 py-6 inline-block">
          <span className="text-stone-900 font-medium">Learn more</span>
        </div>
      </section>
    </main>
  );
}`;
    case "Playful":
      return `export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-200 via-orange-200 to-yellow-200 text-purple-900 px-8 py-20">
      <section className="max-w-4xl mx-auto">
        <p className="text-pink-600 font-bold text-sm mb-6 rounded-full bg-white px-4 py-1 inline-block">Playful variation</p>
        <h1 className="text-6xl md:text-7xl font-extrabold leading-tight mb-8">${safePrompt}</h1>
        <p className="text-xl text-purple-800 max-w-2xl">A joyful, rounded, and colorful variation — bright palettes and expressive shapes.</p>
        <button className="mt-10 bg-purple-900 text-white font-bold px-8 py-4 rounded-full hover:scale-105 transition">Let's go!</button>
      </section>
    </main>
  );
}`;
    case "Minimal":
      return `export default function App() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 px-8 py-32">
      <section className="max-w-3xl mx-auto">
        <p className="text-neutral-400 text-xs uppercase tracking-widest mb-12">Minimal variation</p>
        <h1 className="text-4xl md:text-5xl font-light leading-tight mb-12">${safePrompt}</h1>
        <p className="text-base text-neutral-600 max-w-xl leading-loose">A quiet variation — whitespace-first, low decoration, and typographic restraint.</p>
        <a className="mt-16 inline-block border-b border-neutral-900 text-neutral-900 hover:text-neutral-500 transition">Continue</a>
      </section>
    </main>
  );
}`;
    case "Cinematic":
    default:
      return `export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-900 to-black text-white">
      <section className="min-h-screen flex items-center justify-center px-8">
        <div className="max-w-5xl text-center">
          <p className="text-indigo-300 tracking-[0.3em] uppercase text-xs mb-8">Cinematic variation</p>
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight leading-[0.95] mb-10 bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">${safePrompt}</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">A dramatic, full-bleed variation — gradients, scale, and atmospheric contrast.</p>
        </div>
      </section>
    </main>
  );
}`;
  }
}

export async function generateFreeformVariations(
  input: GenerateFreeformVariationsInput
): Promise<FreeformVariationResult[]> {
  const env = input.env ?? process.env;
  const count = Math.max(1, Math.min(5, input.count));
  const indices = Array.from({ length: count }, (_, i) => i);

  const passes = indices.map(async (index) => {
    const tone = TONE_LABELS[index % TONE_LABELS.length]!;
    const tonePrompt = `${input.prompt} (variation ${index + 1}, ${tone.toLowerCase()} tone)`;
    const label = `Variation ${index + 1} — ${tone}`;
    try {
      const result = await generateFreeformCode({
        artifactKind: input.artifactKind,
        artifactName: input.artifactName,
        prompt: tonePrompt,
        ...(input.designSystem ? { designSystem: input.designSystem } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        env
      });
      const code = result.files["/App.tsx"] ?? "";
      const provider: "litellm" | "heuristic" =
        result.diagnostics.provider === "litellm" ? "litellm" : "heuristic";
      return {
        label,
        tone,
        code,
        intent: result.intent,
        rationale: result.rationale,
        provider
      } satisfies FreeformVariationResult;
    } catch {
      return {
        label,
        tone,
        code: buildHeuristicFreeformVariationCode(tone, input.prompt),
        intent: `Generate a freeform ${input.artifactKind} artifact for ${input.artifactName}: ${tonePrompt}`,
        rationale: `Heuristic ${tone.toLowerCase()} variation produced after gateway failure.`,
        provider: "heuristic"
      } satisfies FreeformVariationResult;
    }
  });

  return Promise.all(passes);
}
