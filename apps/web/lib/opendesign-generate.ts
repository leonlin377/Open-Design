import type { ArtifactGenerateStreamEvent } from "@opendesign/contracts";
import type { ApiArtifactGenerateResponse } from "./opendesign-api";
import { readApiErrorMessage } from "./api-errors";

export type GenerateRetryHandle =
  | { retryable: true; prompt: string; designSystemPackId?: string }
  | { retryable: false }
  | null;

export type GenerateStreamOutcome =
  | { kind: "completed"; payload: ApiArtifactGenerateResponse }
  | { kind: "failed"; message: string; retry: GenerateRetryHandle };

export async function readGenerationEventStream(
  response: Response,
  onEvent: (event: ArtifactGenerateStreamEvent) => void,
  signal: AbortSignal
) {
  if (!response.body) {
    throw new Error("Generation stream ended before any events were received.");
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

      onEvent(JSON.parse(dataLines.join("\n")) as ArtifactGenerateStreamEvent);
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

export async function consumeGenerationStream(
  response: Response,
  onProgress: (message: string) => void,
  signal: AbortSignal
): Promise<GenerateStreamOutcome> {
  let completedPayload: ApiArtifactGenerateResponse | null = null;
  let failureMessage: string | null = null;
  let retry: GenerateRetryHandle = null;

  await readGenerationEventStream(
    response,
    (event) => {
      onProgress(event.message);

      if (event.type === "failed") {
        failureMessage = readApiErrorMessage(event.error, "Artifact generation failed.");
        retry = event.retry ?? null;
        return;
      }

      if (event.type === "completed") {
        completedPayload = event.result;
      }
    },
    signal
  );

  if (failureMessage) {
    return { kind: "failed", message: failureMessage, retry };
  }

  if (!completedPayload) {
    return {
      kind: "failed",
      message: "Generation stream ended before a completion event was received.",
      retry: null
    };
  }

  return { kind: "completed", payload: completedPayload };
}
