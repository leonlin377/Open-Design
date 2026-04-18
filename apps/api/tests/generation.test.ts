import { afterEach, describe, expect, test, vi } from "vitest";
import { generateArtifactPlan } from "../src/generation";

const originalFetch = globalThis.fetch;

function buildStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }

        controller.close();
      }
    }),
    {
      status: 200,
      headers: {
        "content-type": "text/event-stream"
      }
    }
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("generateArtifactPlan", () => {
  test("falls back to the heuristic planner when LiteLLM is not configured", async () => {
    const result = await generateArtifactPlan({
      artifactKind: "website",
      artifactName: "Atlas",
      prompt: "Create a launch page with a hero and CTA.",
      env: {}
    });

    expect(result.plan.provider).toBe("heuristic");
    expect(result.diagnostics.transport).toBe("fallback");
    expect(result.diagnostics.warning).toMatch(/not configured/i);
  });

  test("consumes LiteLLM chat completion streams into a validated plan", async () => {
    const generatedJson = JSON.stringify({
      intent: "Build a cinematic launch surface for Atlas.",
      rationale: "Use a hero, supporting grid, and CTA.",
      sections: ["hero", "feature-grid", "cta"],
      provider: "heuristic"
    });
    const midpoint = Math.floor(generatedJson.length / 2);
    const partA = generatedJson.slice(0, midpoint);
    const partB = generatedJson.slice(midpoint);

    globalThis.fetch = vi.fn(async () =>
      buildStreamResponse([
        `data: ${JSON.stringify({
          choices: [{ delta: { content: partA } }]
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [{ delta: { content: partB } }]
        })}\n\n`,
        "data: [DONE]\n\n"
      ])
    ) as typeof globalThis.fetch;

    const result = await generateArtifactPlan({
      artifactKind: "website",
      artifactName: "Atlas",
      prompt: "Create a launch page with a hero and CTA.",
      env: {
        LITELLM_API_BASE_URL: "http://127.0.0.1:4001",
        OPENDESIGN_GENERATION_MODEL: "openai/gpt-4.1-mini"
      }
    });

    expect(result.plan.provider).toBe("litellm");
    expect(result.plan.sections).toEqual(["hero", "feature-grid", "cta"]);
    expect(result.diagnostics).toEqual({
      provider: "litellm",
      transport: "stream",
      warning: null
    });
  });

  test("falls back when LiteLLM returns an invalid streamed payload", async () => {
    globalThis.fetch = vi.fn(async () =>
      buildStreamResponse(["data: {not-json}\n\n", "data: [DONE]\n\n"])
    ) as typeof globalThis.fetch;

    const result = await generateArtifactPlan({
      artifactKind: "website",
      artifactName: "Atlas",
      prompt: "Create a launch page with a hero and CTA.",
      env: {
        LITELLM_API_BASE_URL: "http://127.0.0.1:4001",
        OPENDESIGN_GENERATION_MODEL: "openai/gpt-4.1-mini"
      }
    });

    expect(result.plan.provider).toBe("heuristic");
    expect(result.diagnostics.transport).toBe("fallback");
    expect(result.diagnostics.warning).toMatch(/invalid streamed plan/i);
  });

  test("accepts non-stream JSON chat completion payloads from the gateway", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intent: "Build a cinematic launch surface for Atlas.",
                  rationale: "Use a hero, supporting grid, and CTA.",
                  sections: ["hero", "feature-grid", "cta"],
                  provider: "heuristic"
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    ) as typeof globalThis.fetch;

    const result = await generateArtifactPlan({
      artifactKind: "website",
      artifactName: "Atlas",
      prompt: "Create a launch page with a hero and CTA.",
      env: {
        LITELLM_API_BASE_URL: "http://127.0.0.1:4001",
        OPENDESIGN_GENERATION_MODEL: "openai/gpt-4.1-mini"
      }
    });

    expect(result.plan.provider).toBe("litellm");
    expect(result.plan.sections).toEqual(["hero", "feature-grid", "cta"]);
    expect(result.diagnostics.warning).toBeNull();
  });
});
