import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGenerationStreamEvent,
  ImageGenerationError
} from "@opendesign/contracts/image-generation";

/**
 * Client-side helpers for talking to the artifact image generation endpoint.
 * Runs in the browser against the web -> api proxy — the web app's existing
 * server actions handle project/artifact auth; this client assumes the caller
 * is already scoped to a concrete project + artifact.
 */

export type ImagePickerGenerationOutcome =
  | { kind: "completed"; result: ImageGenerationResult }
  | { kind: "failed"; error: ImageGenerationError };

export interface GenerateArtifactImageArgs {
  projectId: string;
  artifactId: string;
  request: ImageGenerationRequest;
  signal?: AbortSignal | undefined;
  /** Optional lifecycle callback invoked for every streamed event. */
  onEvent?: (event: ImageGenerationStreamEvent) => void;
}

function buildImageEndpoint(projectId: string, artifactId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(artifactId)}/images/generate`;
}

/**
 * POST to the streaming image generation endpoint and resolve once the
 * terminal `completed` or `failed` event arrives. Falls back to reading a
 * plain JSON body if the server responded with `application/json` (unit tests
 * and non-streaming clients).
 */
export async function generateArtifactImage(
  args: GenerateArtifactImageArgs
): Promise<ImagePickerGenerationOutcome> {
  const response = await fetch(buildImageEndpoint(args.projectId, args.artifactId), {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream, application/json"
    },
    body: JSON.stringify(args.request),
    ...(args.signal ? { signal: args.signal } : {})
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream") && response.body) {
    return consumeImageStream(response, args.onEvent, args.signal);
  }

  if (!response.ok) {
    const parsedError = await readJsonSafely<ImageGenerationError>(response);
    const fallbackError: ImageGenerationError = parsedError ?? {
      error: `Image generation request failed (${response.status}).`,
      code: "IMAGE_PROVIDER_FAILURE",
      recoverable: true
    };
    args.onEvent?.({
      type: "failed",
      message: fallbackError.error,
      error: fallbackError
    });
    return { kind: "failed", error: fallbackError };
  }

  const result = (await response.json()) as ImageGenerationResult;
  args.onEvent?.({
    type: "completed",
    message: "Image generation completed.",
    result
  });
  return { kind: "completed", result };
}

async function consumeImageStream(
  response: Response,
  onEvent: GenerateArtifactImageArgs["onEvent"],
  signal: AbortSignal | undefined
): Promise<ImagePickerGenerationOutcome> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outcome: ImagePickerGenerationOutcome | null = null;

  const abortHandler = () => {
    reader.cancel().catch(() => {
      /* already closed */
    });
  };
  signal?.addEventListener("abort", abortHandler, { once: true });

  const processFrames = (incoming: string) => {
    const frames = incoming.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data) {
        continue;
      }
      const event = JSON.parse(data) as ImageGenerationStreamEvent;
      onEvent?.(event);
      if (event.type === "completed") {
        outcome = { kind: "completed", result: event.result };
      } else if (event.type === "failed") {
        outcome = { kind: "failed", error: event.error };
      }
    }
  };

  try {
    // Loop until the reader signals done.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      processFrames(buffer);
      if (done) {
        break;
      }
    }
    if (buffer.trim().length > 0) {
      processFrames(`${buffer}\n\n`);
    }
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }

  if (!outcome) {
    return {
      kind: "failed",
      error: {
        error: "Image generation stream ended without a terminal event.",
        code: "IMAGE_PROVIDER_FAILURE",
        recoverable: true
      }
    };
  }
  return outcome;
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    const parsed = (await response.clone().json()) as T;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * URL to GET the raw bytes of a persisted artifact asset — used by the picker
 * to render previews in `<img>` tags.
 */
export function getArtifactImageAssetUrl(input: {
  projectId: string;
  artifactId: string;
  assetId: string;
}): string {
  return `/api/projects/${encodeURIComponent(input.projectId)}/artifacts/${encodeURIComponent(input.artifactId)}/assets/${encodeURIComponent(input.assetId)}`;
}
