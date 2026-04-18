import {
  ArtifactGenerationPlanSchema,
  type ArtifactGenerationPlan,
  type ArtifactKind,
  type SceneTemplateKind
} from "@opendesign/contracts";

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

async function generatePlanViaLiteLLM(
  input: GenerateArtifactPlanInput,
  env: NodeJS.ProcessEnv
): Promise<ArtifactGenerationPlan | null> {
  const baseUrl = env.LITELLM_API_BASE_URL ?? env.OPENAI_API_BASE_URL;
  const model = env.OPENDESIGN_GENERATION_MODEL;

  if (!baseUrl || !model) {
    return null;
  }

  const apiKey =
    env.LITELLM_MASTER_KEY ?? env.OPENAI_API_KEY ?? env.LITELLM_API_KEY ?? "";

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      model,
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

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return ArtifactGenerationPlanSchema.parse({
      ...parsed,
      prompt: input.prompt,
      provider: "litellm"
    });
  } catch {
    return null;
  }
}

export async function generateArtifactPlan(
  input: GenerateArtifactPlanInput
): Promise<ArtifactGenerationPlan> {
  const env = input.env ?? process.env;

  try {
    const remotePlan = await generatePlanViaLiteLLM(input, env);

    if (remotePlan) {
      return remotePlan;
    }
  } catch {
    // Fall through to heuristic generation when the gateway is unavailable.
  }

  return buildHeuristicPlan(input);
}
