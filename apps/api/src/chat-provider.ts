import type { ApiError, ArtifactKind } from "@opendesign/contracts";
import type {
  ChatDiagnostics,
  ChatMessage,
  ChatSelectedNode
} from "@opendesign/contracts/src/chat";
import { streamText } from "ai";
import { createLLMClient } from "./llm-client";

export class ChatProviderError extends Error {
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
    this.name = "ChatProviderError";
    this.code = input.code;
    this.recoverable = input.recoverable ?? true;
    this.details = input.details;
  }
}

export interface ChatProviderContext {
  artifactKind: ArtifactKind;
  artifactName: string;
  sceneSummary: string;
  selectedNode?: ChatSelectedNode | null;
  history: Pick<ChatMessage, "role" | "content">[];
  prompt: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  onDelta?: (content: string) => void;
}

export interface ChatProviderResult {
  content: string;
  diagnostics: ChatDiagnostics;
}

export interface ChatProvider {
  generateReply(context: ChatProviderContext): Promise<ChatProviderResult>;
}

const HEURISTIC_FALLBACK_MESSAGE =
  "Fallback reply — live gateway not configured. Configure LITELLM_API_BASE_URL + OPENDESIGN_CHAT_MODEL.";

function buildHeuristicReply(context: ChatProviderContext): string {
  const selected = context.selectedNode
    ? ` (focused on "${context.selectedNode.nodeName}" / ${context.selectedNode.nodeType})`
    : "";
  const prompt = context.prompt.slice(0, 160);
  return `${HEURISTIC_FALLBACK_MESSAGE} I would answer "${prompt}" about ${context.artifactKind} "${context.artifactName}"${selected}.`;
}

function buildSystemPrompt(context: ChatProviderContext): string {
  const selected = context.selectedNode
    ? `\n\nThe user's question is focused on scene node "${context.selectedNode.nodeName}" (id=${context.selectedNode.nodeId}, type=${context.selectedNode.nodeType}). Scope your answer to that element where possible.`
    : "";
  return `You are the Studio assistant for OpenDesign. You are embedded in a chat sidecar attached to a ${context.artifactKind} artifact named "${context.artifactName}".

Scene summary:
${context.sceneSummary}

Answer concisely. When the user asks for edits, describe the concrete change you would apply to the scene tree; do not invent node IDs.${selected}`;
}

async function generateReplyViaLiteLLM(
  context: ChatProviderContext,
  env: NodeJS.ProcessEnv
): Promise<ChatProviderResult> {
  const client = createLLMClient(env);
  const model = env.OPENDESIGN_CHAT_MODEL;

  if (!client || !model) {
    throw new ChatProviderError({
      message: "Chat provider is not configured.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm", configured: false }
    });
  }

  const messages = context.history.map((entry) => ({
    role: entry.role as "user" | "assistant" | "system",
    content: entry.content
  }));

  let content = "";
  try {
    const result = streamText({
      model: client(model),
      system: buildSystemPrompt(context),
      messages,
      temperature: 0.3,
      abortSignal: context.signal,
      maxRetries: 1,
    });

    for await (const delta of result.textStream) {
      content += delta;
      context.onDelta?.(delta);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ChatProviderError({
        message: "Chat was cancelled.",
        code: "GENERATION_CANCELLED",
        details: { provider: "litellm" }
      });
    }
    throw new ChatProviderError({
      message: "Chat provider request failed.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm" }
    });
  }

  if (!content) {
    throw new ChatProviderError({
      message: "Chat provider returned an empty response.",
      code: "GENERATION_PROVIDER_FAILURE",
      details: { provider: "litellm" }
    });
  }

  return {
    content,
    diagnostics: {
      provider: "litellm",
      transport: "stream",
      warning: null
    }
  };
}

export class LiteLLMChatProvider implements ChatProvider {
  async generateReply(context: ChatProviderContext): Promise<ChatProviderResult> {
    const env = context.env ?? process.env;
    const configured = Boolean(
      (env.LITELLM_API_BASE_URL ?? env.OPENAI_API_BASE_URL) && env.OPENDESIGN_CHAT_MODEL
    );

    if (!configured) {
      if (context.signal?.aborted) {
        throw new ChatProviderError({
          message: "Chat was cancelled before the heuristic fallback ran.",
          code: "GENERATION_CANCELLED",
          details: { provider: "heuristic" }
        });
      }

      const content = buildHeuristicReply(context);
      context.onDelta?.(content);

      return {
        content,
        diagnostics: {
          provider: "heuristic",
          transport: "fallback",
          warning: HEURISTIC_FALLBACK_MESSAGE
        }
      };
    }

    return generateReplyViaLiteLLM(context, env);
  }
}

export const defaultChatProvider: ChatProvider = new LiteLLMChatProvider();
