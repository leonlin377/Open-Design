import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLLMClient(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = env.LITELLM_API_BASE_URL ?? env.OPENAI_API_BASE_URL;
  const apiKey =
    env.LITELLM_MASTER_KEY ?? env.OPENAI_API_KEY ?? env.LITELLM_API_KEY ?? "";

  if (!baseUrl) {
    return null;
  }

  return createOpenAICompatible({
    name: "litellm",
    baseURL: baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl,
    apiKey,
  });
}
