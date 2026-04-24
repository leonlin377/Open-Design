import { z } from "zod";
import {
  ApiErrorSchema,
  ArtifactKindSchema,
  type ApiError,
  type ArtifactKind
} from "./index";

// See the note in `./remix.ts` — `./index` now re-exports this module via the
// barrel, so referencing these schemas directly at module top level can race
// with the partially-evaluated index. Defer the lookup to parse-time with
// `z.lazy` so the ordering of re-exports cannot break schema initialisation.
const LazyApiErrorSchema: z.ZodType<ApiError> = z.lazy(() => ApiErrorSchema);
const LazyArtifactKindSchema: z.ZodType<ArtifactKind> = z.lazy(
  () => ArtifactKindSchema
);

// -----------------------------------------------------------------------------
// Studio Chat — conversational sidecar for an artifact.
//
// Shape mirrors the generation stream (`ArtifactGenerateStreamEventSchema`) so
// the client streaming consumer pattern (SSE `data: <json>\n\n` frames, typed
// discriminated union events) is identical across features.
// -----------------------------------------------------------------------------

export const ChatRoleSchema = z.enum(["user", "assistant", "system"]);

/**
 * Optional pointer at a specific scene node. When set, the assistant is
 * expected to scope its answer to that node ("Ask about selected element"
 * mode in the Studio panel).
 */
export const ChatSelectedNodeSchema = z.object({
  nodeId: z.string().min(1),
  nodeName: z.string().min(1),
  nodeType: z.string().min(1)
});

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  role: ChatRoleSchema,
  content: z.string().min(1),
  selectedNode: ChatSelectedNodeSchema.nullable().default(null),
  createdAt: z.string().min(1)
});

export const ChatThreadSchema = z.object({
  id: z.string().min(1),
  artifactId: z.string().min(1),
  artifactKind: LazyArtifactKindSchema,
  /** Short scene summary seeded into the system message on thread creation. */
  sceneSummary: z.string().min(1),
  messages: z.array(ChatMessageSchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const ChatProviderSchema = z.enum(["litellm", "heuristic"]);
export const ChatTransportSchema = z.enum(["stream", "json", "fallback"]);

export const ChatDiagnosticsSchema = z.object({
  provider: ChatProviderSchema,
  transport: ChatTransportSchema,
  warning: z.string().min(1).nullable()
});

/**
 * Streaming frames emitted from `POST /chat/messages`. Intentionally mirrors
 * `ArtifactGenerateStreamEventSchema`:
 *   started  → assistant turn has begun
 *   delta    → incremental token content (may be empty string; receiver
 *              concatenates)
 *   completed→ final assistant `ChatMessage` with diagnostics
 *   failed   → error frame with optional retryable envelope
 */
export const ChatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    message: z.string().min(1),
    userMessage: ChatMessageSchema
  }),
  z.object({
    type: z.literal("delta"),
    content: z.string()
  }),
  z.object({
    type: z.literal("completed"),
    message: z.string().min(1),
    assistantMessage: ChatMessageSchema,
    diagnostics: ChatDiagnosticsSchema
  }),
  z.object({
    type: z.literal("failed"),
    message: z.string().min(1),
    error: LazyApiErrorSchema,
    retry: z
      .discriminatedUnion("retryable", [
        z.object({
          retryable: z.literal(true),
          prompt: z.string().min(1),
          selectedNode: ChatSelectedNodeSchema.nullable().optional()
        }),
        z.object({
          retryable: z.literal(false)
        })
      ])
      .optional()
  })
]);

export const ChatSendRequestSchema = z.object({
  prompt: z.string().min(1),
  selectedNode: ChatSelectedNodeSchema.nullable().optional()
});

export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ChatSelectedNode = z.infer<typeof ChatSelectedNodeSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatThread = z.infer<typeof ChatThreadSchema>;
export type ChatProvider = z.infer<typeof ChatProviderSchema>;
export type ChatTransport = z.infer<typeof ChatTransportSchema>;
export type ChatDiagnostics = z.infer<typeof ChatDiagnosticsSchema>;
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
export type ChatSendRequest = z.infer<typeof ChatSendRequestSchema>;
