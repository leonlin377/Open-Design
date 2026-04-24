import type { SceneNode } from "@opendesign/contracts";
import {
  ChatSendRequestSchema,
  ChatStreamEventSchema,
  type ChatStreamEvent,
  type ChatMessage
} from "@opendesign/contracts/src/chat";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ChatProviderError, type ChatProvider } from "../chat-provider";
import { buildApiError, sendApiError } from "../lib/api-errors";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import { createEmptySceneDocument } from "@opendesign/scene-engine";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ProjectRepository } from "../repositories/projects";
import type { ChatRepository } from "../repositories/chat";

// -----------------------------------------------------------------------------
// Chat routes — streams assistant replies back to the Studio sidecar.
//
//   POST  /api/projects/:projectId/artifacts/:artifactId/chat/messages
//           → SSE stream of ChatStreamEvent. On first connection the server
//             seeds a system message with the artifact's scene summary.
//   GET   /api/projects/:projectId/artifacts/:artifactId/chat/thread
//           → Full ChatThread (for hydration on panel mount).
//
// The SSE event shape intentionally mirrors the generation stream so the
// client can share its frame reader (see studio-generate-panel.tsx for
// the same `data: <json>\n\n` pattern).
// -----------------------------------------------------------------------------

const chatParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

export interface ChatRouteOptions {
  chat: ChatProvider;
  chatRepository: ChatRepository;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  workspaces: ArtifactWorkspaceRepository;
  /**
   * Auth is optional so the route plugin can be mounted by tests that don't
   * spin up better-auth. When absent, requests resolve as anonymous — the
   * main thread wires real auth in through the route index.
   */
  auth?: OpenDesignAuth;
}

interface ChatStreamSession {
  writeEvent: (event: ChatStreamEvent) => void;
  close: () => void;
  isClosed: () => boolean;
  onClientClose: (handler: () => void) => void;
}

function beginChatEventStream(reply: FastifyReply, request: FastifyRequest): ChatStreamSession {
  reply.hijack();
  const origin = request.headers.origin;
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    ...(origin ? {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true"
    } : {})
  });

  if (typeof reply.raw.flushHeaders === "function") {
    reply.raw.flushHeaders();
  }

  let closed = false;
  let clientCloseHandler: (() => void) | null = null;

  const writeEvent = (event: ChatStreamEvent) => {
    if (closed) {
      return;
    }
    reply.raw.write(
      `data: ${JSON.stringify(ChatStreamEventSchema.parse(event))}\n\n`
    );
  };

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    reply.raw.end();
  };

  reply.raw.on("close", () => {
    if (!closed) {
      closed = true;
      clientCloseHandler?.();
    }
  });

  return {
    writeEvent,
    close,
    isClosed: () => closed,
    onClientClose: (handler) => {
      clientCloseHandler = handler;
    }
  };
}

function chatStatusForCode(code: string): number {
  switch (code) {
    case "GENERATION_TIMEOUT":
      return 504;
    case "GENERATION_PROVIDER_FAILURE":
      return 502;
    case "GENERATION_CANCELLED":
      return 422;
    default:
      return 500;
  }
}

function mapChatFailure(error: unknown) {
  if (error instanceof ChatProviderError) {
    const apiError = buildApiError({
      error: error.message,
      code: error.code,
      recoverable: error.recoverable,
      ...(error.details ? { details: error.details } : {})
    });
    return {
      statusCode: chatStatusForCode(error.code),
      apiError
    };
  }

  return {
    statusCode: 500,
    apiError: buildApiError({
      error: "Chat failed.",
      code: "WORKSPACE_UPDATE_FAILED",
      recoverable: true,
      details: { stage: "chat" }
    })
  };
}

/**
 * Derive a compact, stable scene summary for the system seed message. We don't
 * need a full scene dump — the assistant is given enough to answer structural
 * questions without bloating the system prompt.
 */
function summarizeSceneNodes(nodes: SceneNode[]): string {
  if (nodes.length === 0) {
    return "The artifact currently has no scene nodes.";
  }

  const lines = nodes.slice(0, 12).map((node, index) => {
    const childCount = node.children?.length ?? 0;
    return `  ${index + 1}. ${node.name} (${node.type}${childCount ? `, ${childCount} children` : ""})`;
  });

  const overflow =
    nodes.length > lines.length ? `\n  … ${nodes.length - lines.length} more` : "";

  return `Scene has ${nodes.length} root node${nodes.length === 1 ? "" : "s"}:\n${lines.join("\n")}${overflow}`;
}

export const registerChatRoutes: FastifyPluginAsync<ChatRouteOptions> = async (
  app,
  options
) => {
  async function resolveAuthorizedArtifact(
    request: FastifyRequest,
    input: { projectId: string; artifactId: string }
  ) {
    const session = options.auth
      ? await getRequestSession(options.auth, request)
      : null;

    const project = await options.projects.getById(input.projectId);
    if (!project) {
      return { session, project: null, artifact: null };
    }

    // Only apply owner check when auth is wired and the project has an owner.
    if (options.auth && project.ownerUserId && project.ownerUserId !== session?.user.id) {
      return { session, project: null, artifact: null };
    }

    const artifact = await options.artifacts.getById(input.projectId, input.artifactId);
    return { session, project, artifact };
  }

  async function loadSceneSummary(artifactId: string, artifactKind: string) {
    const workspace = await options.workspaces.getByArtifactId(artifactId);
    if (workspace) {
      return summarizeSceneNodes(workspace.sceneDocument.nodes);
    }
    // Workspace hasn't been seeded yet — describe an empty scene explicitly.
    const empty = createEmptySceneDocument({
      id: `scene_${crypto.randomUUID()}`,
      artifactId,
      kind: artifactKind as Parameters<typeof createEmptySceneDocument>[0]["kind"]
    });
    return summarizeSceneNodes(empty.nodes);
  }

  app.get(
    "/projects/:projectId/artifacts/:artifactId/chat/thread",
    async (request, reply) => {
      const params = chatParamsSchema.parse(request.params);
      const { artifact, project } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }
      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const sceneSummary = await loadSceneSummary(artifact.id, artifact.kind);
      const thread = await options.chatRepository.ensureThread({
        artifactId: artifact.id,
        artifactKind: artifact.kind,
        sceneSummary
      });

      return reply.send({ thread });
    }
  );

  app.post(
    "/projects/:projectId/artifacts/:artifactId/chat/messages",
    async (request, reply) => {
      const params = chatParamsSchema.parse(request.params);
      const body = ChatSendRequestSchema.parse(request.body);
      const { artifact, project } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }
      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const sceneSummary = await loadSceneSummary(artifact.id, artifact.kind);
      const thread = await options.chatRepository.ensureThread({
        artifactId: artifact.id,
        artifactKind: artifact.kind,
        sceneSummary
      });

      const userMessage: ChatMessage = await options.chatRepository.appendMessage({
        artifactId: artifact.id,
        role: "user",
        content: body.prompt,
        selectedNode: body.selectedNode ?? null
      });

      const controller = new AbortController();
      const streamSession = beginChatEventStream(reply, request);
      streamSession.onClientClose(() => {
        controller.abort();
      });

      try {
        streamSession.writeEvent({
          type: "started",
          message: "Assistant is composing a reply.",
          userMessage
        });

        // Build history including the user message we just persisted; the
        // provider's `prompt` is a convenience copy of the latest user entry.
        const history = [
          ...thread.messages.map((message) => ({
            role: message.role,
            content: message.content
          })),
          { role: userMessage.role, content: userMessage.content }
        ];

        const result = await options.chat.generateReply({
          artifactKind: artifact.kind,
          artifactName: artifact.name,
          sceneSummary,
          selectedNode: body.selectedNode ?? null,
          history,
          prompt: body.prompt,
          signal: controller.signal,
          onDelta: (content) => {
            streamSession.writeEvent({ type: "delta", content });
          }
        });

        if (controller.signal.aborted) {
          throw new ChatProviderError({
            message: "Chat was cancelled before it could commit.",
            code: "GENERATION_CANCELLED",
            details: { stage: "chat" }
          });
        }

        const assistantMessage = await options.chatRepository.appendMessage({
          artifactId: artifact.id,
          role: "assistant",
          content: result.content,
          selectedNode: body.selectedNode ?? null
        });

        streamSession.writeEvent({
          type: "completed",
          message: "Assistant reply complete.",
          assistantMessage,
          diagnostics: result.diagnostics
        });
      } catch (error) {
        const { apiError } = mapChatFailure(error);
        const retryable =
          apiError.code === "GENERATION_TIMEOUT" ||
          apiError.code === "GENERATION_CANCELLED" ||
          apiError.code === "GENERATION_PROVIDER_FAILURE" ||
          apiError.code === "WORKSPACE_UPDATE_FAILED";

        streamSession.writeEvent({
          type: "failed",
          message: apiError.error,
          error: apiError,
          retry: retryable
            ? {
                retryable: true,
                prompt: body.prompt,
                ...(body.selectedNode
                  ? { selectedNode: body.selectedNode }
                  : {})
              }
            : { retryable: false }
        });
      } finally {
        streamSession.close();
      }
    }
  );
};
