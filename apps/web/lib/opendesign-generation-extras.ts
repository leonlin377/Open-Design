"use client";

import type {
  ArtifactGenerationVariation,
  ArtifactGenerationVariationsResponse,
  ArtifactRefineStreamEvent,
  ArtifactVariationAcceptResponse
} from "@opendesign/contracts/src/generation-extras";

function apiOrigin(): string {
  return process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000";
}

export async function fetchVariations(input: {
  projectId: string;
  artifactId: string;
  prompt: string;
  count?: number;
  signal?: AbortSignal;
}): Promise<ArtifactGenerationVariationsResponse> {
  const response = await fetch(
    `${apiOrigin()}/api/projects/${input.projectId}/artifacts/${input.artifactId}/generate/variations`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: input.prompt,
        ...(input.count ? { count: input.count } : {})
      }),
      ...(input.signal ? { signal: input.signal } : {})
    }
  );
  if (!response.ok) {
    throw new Error(`Variations failed (${response.status}).`);
  }
  return (await response.json()) as ArtifactGenerationVariationsResponse;
}

export async function acceptVariation(input: {
  projectId: string;
  artifactId: string;
  variationId: string;
}): Promise<ArtifactVariationAcceptResponse> {
  const response = await fetch(
    `${apiOrigin()}/api/projects/${input.projectId}/artifacts/${input.artifactId}/variations/accept`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variationId: input.variationId })
    }
  );
  if (!response.ok) {
    throw new Error(`Accept variation failed (${response.status}).`);
  }
  return (await response.json()) as ArtifactVariationAcceptResponse;
}

/**
 * Streams refine SSE events. Caller passes a node id + natural language
 * instruction and receives started/planning/applying/completed/failed events.
 */
export async function streamRefineNode(input: {
  projectId: string;
  artifactId: string;
  nodeId: string;
  instruction: string;
  signal?: AbortSignal;
  onEvent: (event: ArtifactRefineStreamEvent) => void;
}): Promise<void> {
  const response = await fetch(
    `${apiOrigin()}/api/projects/${input.projectId}/artifacts/${input.artifactId}/refine`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        nodeId: input.nodeId,
        instruction: input.instruction
      }),
      ...(input.signal ? { signal: input.signal } : {})
    }
  );

  if (!response.ok) {
    throw new Error(`Refine stream failed (${response.status}).`);
  }
  if (!response.body) {
    throw new Error("Refine stream ended without a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!dataLine) {
          continue;
        }
        input.onEvent(JSON.parse(dataLine) as ArtifactRefineStreamEvent);
      }
      if (done) {
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export type {
  ArtifactGenerationVariation,
  ArtifactGenerationVariationsResponse,
  ArtifactRefineStreamEvent,
  ArtifactVariationAcceptResponse
};
