import type {
  ChatMessage,
  ChatSelectedNode,
  ChatStreamEvent,
  ChatThread
} from "@opendesign/contracts/src/chat";
import { buildApiRequestError } from "./api-errors";

// -----------------------------------------------------------------------------
// Studio chat client helper — thin wrapper over the streaming chat endpoint.
//
// Mirrors the generation stream reader in studio-generate-panel.tsx so the
// panel's state machine can stay simple and familiar. Consumers pass a
// single onEvent handler; cancellation is driven through AbortController.
// -----------------------------------------------------------------------------

function resolveApiOrigin(): string {
  if (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_API_ORIGIN === "string" &&
    process.env.NEXT_PUBLIC_API_ORIGIN.length > 0
  ) {
    return process.env.NEXT_PUBLIC_API_ORIGIN;
  }
  return "http://127.0.0.1:4000";
}

export interface FetchChatThreadInput {
  projectId: string;
  artifactId: string;
  signal?: AbortSignal;
  apiOrigin?: string;
}

export async function fetchChatThread(
  input: FetchChatThreadInput
): Promise<ChatThread> {
  const origin = input.apiOrigin ?? resolveApiOrigin();
  const response = await fetch(
    `${origin}/api/projects/${input.projectId}/artifacts/${input.artifactId}/chat/thread`,
    {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json" },
      signal: input.signal
    }
  );

  if (!response.ok) {
    throw await buildApiRequestError(response, "Chat thread could not be loaded.");
  }

  const body = (await response.json()) as { thread: ChatThread };
  return body.thread;
}

async function readChatEventStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
  signal: AbortSignal
): Promise<void> {
  if (!response.body) {
    throw new Error("Chat stream ended before any events were received.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => {
    reader.cancel().catch(() => {
      /* reader already closed */
    });
  };
  signal.addEventListener("abort", onAbort, { once: true });

  function flushFrames(input: string) {
    const frames = input.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const dataLines = frame
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) {
        continue;
      }
      onEvent(JSON.parse(dataLines.join("\n")) as ChatStreamEvent);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      flushFrames(buffer);
      if (done) {
        break;
      }
    }
    if (buffer.trim().length > 0) {
      flushFrames(`${buffer}\n\n`);
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export interface SendChatMessageInput {
  projectId: string;
  artifactId: string;
  prompt: string;
  selectedNode?: ChatSelectedNode | null;
  signal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
  apiOrigin?: string;
}

export interface SendChatMessageOutcome {
  userMessage: ChatMessage | null;
  assistantMessage: ChatMessage | null;
  failure: { message: string; retryable: boolean } | null;
}

/**
 * Stream a new chat turn. Resolves once the stream closes; the outcome
 * captures the final assistant message (or failure). Cancellation is via
 * `input.signal` — mirrors the GEN-003 cancel pattern.
 */
export async function sendChatMessage(
  input: SendChatMessageInput
): Promise<SendChatMessageOutcome> {
  const origin = input.apiOrigin ?? resolveApiOrigin();
  const response = await fetch(
    `${origin}/api/projects/${input.projectId}/artifacts/${input.artifactId}/chat/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        prompt: input.prompt,
        ...(input.selectedNode ? { selectedNode: input.selectedNode } : {})
      }),
      signal: input.signal
    }
  );

  if (!response.ok) {
    throw await buildApiRequestError(response, "Chat request failed.");
  }

  let userMessage: ChatMessage | null = null;
  let assistantMessage: ChatMessage | null = null;
  let failure: { message: string; retryable: boolean } | null = null;

  await readChatEventStream(
    response,
    (event) => {
      switch (event.type) {
        case "started":
          userMessage = event.userMessage;
          break;
        case "completed":
          assistantMessage = event.assistantMessage;
          break;
        case "failed":
          failure = {
            message: event.error.error,
            retryable: event.retry?.retryable === true
          };
          break;
        default:
          break;
      }
      input.onEvent(event);
    },
    input.signal
  );

  return { userMessage, assistantMessage, failure };
}
