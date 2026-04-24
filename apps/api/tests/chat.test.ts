import Fastify from "fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { registerChatRoutes } from "../src/routes/chat";
import {
  LiteLLMChatProvider,
  type ChatProvider,
  type ChatProviderContext,
  type ChatProviderResult
} from "../src/chat-provider";
import { InMemoryChatRepository } from "../src/repositories/chat";
import { InMemoryProjectRepository } from "../src/repositories/projects";
import { InMemoryArtifactRepository } from "../src/repositories/artifacts";
import { InMemoryArtifactWorkspaceRepository } from "../src/repositories/artifact-workspaces";

const originalFetch = globalThis.fetch;

interface TestHarness {
  app: Awaited<ReturnType<typeof Fastify>>;
  projectId: string;
  artifactId: string;
}

function parseSseFrames(body: string): Array<Record<string, unknown>> {
  return body
    .trim()
    .split(/\r?\n\r?\n/)
    .map((frame) =>
      frame
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n")
    )
    .filter((value) => value.length > 0)
    .map((value) => JSON.parse(value) as Record<string, unknown>);
}

async function buildChatHarness(provider: ChatProvider): Promise<TestHarness> {
  const projects = new InMemoryProjectRepository();
  const artifacts = new InMemoryArtifactRepository();
  const workspaces = new InMemoryArtifactWorkspaceRepository();
  const chatRepository = new InMemoryChatRepository();

  const project = await projects.create({ name: "Chat Demo", ownerUserId: null });
  const artifact = await artifacts.create({
    projectId: project.id,
    name: "Launch Page",
    kind: "website"
  });

  const app = Fastify({ logger: false });
  await app.register(
    async (scope) => {
      await scope.register(registerChatRoutes, {
        chat: provider,
        chatRepository,
        projects,
        artifacts,
        workspaces
      });
    },
    { prefix: "/api" }
  );

  return { app, projectId: project.id, artifactId: artifact.id };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("chat routes", () => {
  test("happy path streams started → delta → completed frames", async () => {
    const provider: ChatProvider = {
      async generateReply(context: ChatProviderContext): Promise<ChatProviderResult> {
        context.onDelta?.("Hello ");
        context.onDelta?.("world.");
        return {
          content: "Hello world.",
          diagnostics: { provider: "litellm", transport: "stream", warning: null }
        };
      }
    };

    const { app, projectId, artifactId } = await buildChatHarness(provider);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/artifacts/${artifactId}/chat/messages`,
        headers: { accept: "text/event-stream" },
        payload: { prompt: "Summarize this artifact." }
      });

      expect(response.statusCode).toBe(200);
      const frames = parseSseFrames(response.body);
      const types = frames.map((frame) => frame.type);
      expect(types[0]).toBe("started");
      expect(types).toContain("delta");
      expect(types[types.length - 1]).toBe("completed");

      const completed = frames[frames.length - 1] as {
        assistantMessage: { role: string; content: string };
        diagnostics: { provider: string };
      };
      expect(completed.assistantMessage.role).toBe("assistant");
      expect(completed.assistantMessage.content).toBe("Hello world.");
      expect(completed.diagnostics.provider).toBe("litellm");

      // The thread endpoint should hydrate the seeded system message plus the
      // new user and assistant messages.
      const threadResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/artifacts/${artifactId}/chat/thread`
      });
      expect(threadResponse.statusCode).toBe(200);
      const { thread } = threadResponse.json() as {
        thread: { messages: Array<{ role: string; content: string }> };
      };
      const roles = thread.messages.map((message) => message.role);
      expect(roles).toEqual(["system", "user", "assistant"]);
    } finally {
      await app.close();
    }
  });

  test("cancel mid-stream emits a failed frame with retryable envelope", async () => {
    const provider: ChatProvider = {
      async generateReply(context: ChatProviderContext): Promise<ChatProviderResult> {
        context.onDelta?.("Working…");
        await new Promise<void>((_, reject) => {
          context.signal?.addEventListener("abort", () => {
            reject(
              Object.assign(new Error("aborted by client"), { name: "AbortError" })
            );
          });
        });
        // Unreachable once the signal fires.
        return {
          content: "never",
          diagnostics: { provider: "litellm", transport: "stream", warning: null }
        };
      }
    };

    const { app, projectId, artifactId } = await buildChatHarness(provider);
    try {
      // Abort the stream shortly after it starts by closing the socket. Fastify
      // `inject` runs synchronously, so we instead simulate cancel by injecting
      // a fake abort error by letting the provider throw once its signal fires.
      // Simulate the client-close by aborting the route's controller via a
      // short-lived timer; to keep the test deterministic we have the provider
      // throw an AbortError synchronously on first delta.
      provider.generateReply = async (context) => {
        context.onDelta?.("Partial token");
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      };

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/artifacts/${artifactId}/chat/messages`,
        headers: { accept: "text/event-stream" },
        payload: { prompt: "Cancel this turn." }
      });

      expect(response.statusCode).toBe(200);
      const frames = parseSseFrames(response.body);
      const types = frames.map((frame) => frame.type);
      expect(types).toContain("started");
      expect(types).toContain("delta");
      expect(types[types.length - 1]).toBe("failed");

      const failure = frames[frames.length - 1] as {
        error: { code: string };
        retry?: { retryable: boolean; prompt?: string };
      };
      // The generic AbortError maps to WORKSPACE_UPDATE_FAILED (retryable) via
      // the route's default failure mapper — verify the retry envelope is
      // present and carries the original prompt so the client can resend.
      expect(failure.retry?.retryable).toBe(true);
      expect(failure.retry?.prompt).toBe("Cancel this turn.");
    } finally {
      await app.close();
    }
  });

  test("fallback path uses the heuristic reply when the gateway is not configured", async () => {
    const provider = new LiteLLMChatProvider();
    // Capture the env passed through so the test does not rely on process.env.
    const captured: string[] = [];

    const wrappedProvider: ChatProvider = {
      async generateReply(context) {
        // Force the heuristic branch regardless of the ambient process.env.
        const result = await provider.generateReply({
          ...context,
          env: {}
        });
        captured.push(result.content);
        return result;
      }
    };

    const { app, projectId, artifactId } = await buildChatHarness(wrappedProvider);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/artifacts/${artifactId}/chat/messages`,
        headers: { accept: "text/event-stream" },
        payload: { prompt: "What does this artifact do?" }
      });

      expect(response.statusCode).toBe(200);
      const frames = parseSseFrames(response.body);
      const completed = frames.find((frame) => frame.type === "completed") as
        | {
            assistantMessage: { content: string };
            diagnostics: {
              provider: string;
              transport: string;
              warning: string | null;
            };
          }
        | undefined;
      expect(completed).toBeDefined();
      expect(completed!.diagnostics.provider).toBe("heuristic");
      expect(completed!.diagnostics.transport).toBe("fallback");
      expect(completed!.diagnostics.warning).toMatch(/not configured/i);
      expect(completed!.assistantMessage.content).toMatch(/Fallback reply/);
      expect(captured[0]).toMatch(/Fallback reply/);
    } finally {
      await app.close();
    }
  });
});
