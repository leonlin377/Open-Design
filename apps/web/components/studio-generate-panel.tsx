"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArtifactGenerateStreamEvent } from "@opendesign/contracts";
import { Button, Surface } from "@opendesign/ui";
import type { ApiArtifact } from "../lib/opendesign-api";
import type { ApiArtifactGenerateResponse } from "../lib/opendesign-api";
import { buildApiRequestError, readApiErrorMessage } from "../lib/api-errors";
import { getArtifactEditorAffordance } from "./studio-artifact-affordances";

type StudioGeneratePanelProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ApiArtifact["kind"];
  initialPrompt: string;
};

async function readGenerationEventStream(
  response: Response,
  onEvent: (event: ArtifactGenerateStreamEvent) => void
) {
  if (!response.body) {
    throw new Error("Generation stream ended before any events were received.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
}

async function consumeGenerationStream(
  response: Response,
  onProgress: (message: string) => void
): Promise<ApiArtifactGenerateResponse> {
  let completedPayload: ApiArtifactGenerateResponse | null = null;
  let failureMessage: string | null = null;

  await readGenerationEventStream(response, (event) => {
    onProgress(event.message);

    if (event.type === "failed") {
      failureMessage = readApiErrorMessage(event.error, "Artifact generation failed.");
      return;
    }

    if (event.type === "completed") {
      completedPayload = event.result;
    }
  });

  if (failureMessage) {
    throw new Error(failureMessage);
  }

  if (!completedPayload) {
    throw new Error("Generation stream ended before a completion event was received.");
  }

  return completedPayload;
}

export function StudioGeneratePanel({
  projectId,
  artifactId,
  artifactKind,
  initialPrompt
}: StudioGeneratePanelProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [pending, startTransition] = useTransition();
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const affordance = getArtifactEditorAffordance(artifactKind);
  const unitPluralLabel = `${affordance.unitLabel}s`;
  const apiOrigin = useMemo(
    () => process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000",
    []
  );

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  function handleGenerate() {
    startTransition(async () => {
      try {
        setFeedback(null);
        setProgressMessage("Connecting to the generation pipeline.");

        const response = await fetch(
          `${apiOrigin}/api/projects/${projectId}/artifacts/${artifactId}/generate`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              accept: "text/event-stream",
              "content-type": "application/json"
            },
            body: JSON.stringify({
              prompt
            })
          }
        );

        if (!response.ok) {
          throw await buildApiRequestError(response, "Artifact generation failed.");
        }

        const completedPayload = await consumeGenerationStream(response, (message) => {
          setProgressMessage(message);
        });

        const appendedNodeCount =
          completedPayload.generation.scenePatch.appendedNodes.length;
        const unitLabel =
          appendedNodeCount === 1
            ? affordance.unitLabel
            : `${affordance.unitLabel}s`;

        setFeedback(
          completedPayload.generation.diagnostics.warning
            ? {
                tone: "warning",
                message: `${completedPayload.generation.diagnostics.warning} Generated ${appendedNodeCount} ${unitLabel} for this pass.`
              }
            : {
                tone: "success",
                message: `Generated ${appendedNodeCount} ${unitLabel} via ${completedPayload.generation.plan.provider} and refreshed the Studio workspace.`
              }
        );
        setProgressMessage(null);
        router.refresh();
      } catch (error) {
        setProgressMessage(null);
        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Artifact generation failed."
        });
      }
    });
  }

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>Generate {artifactKind === "slides" ? "Deck" : artifactKind === "prototype" ? "Flow" : "Artifact"}</h3>
        <p className="footer-note">
          Send a prompt into the generation pipeline. LiteLLM streams are used when
          configured; otherwise the backend falls back to the local heuristic planner.
        </p>
      </div>
      <div className="studio-status-row">
        <span className={pending ? "status-pill warning" : "status-pill success"}>
          {pending ? "Generating" : "Generation Ready"}
        </span>
        <span className="footer-note">
          {pending
            ? progressMessage ?? "Waiting for the generation pass to finish and refresh the workspace."
            : `A completed pass appends new ${unitPluralLabel} and creates a prompt snapshot.`}
        </span>
      </div>
      {feedback ? (
        <div className={`studio-feedback ${feedback.tone}`}>{feedback.message}</div>
      ) : null}
      <div className="stack-form">
        <label className="field">
          <span>Prompt</span>
          <textarea
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              artifactKind === "prototype"
                ? "Design a navigable product flow with an entry screen, a comparison screen, and a decisive action screen."
                : artifactKind === "slides"
                  ? "Design a narrative deck with a title slide, a structured system slide, and a strong closing ask."
                  : "Design a cinematic launch surface with a strong hero, proof points, and a conversion CTA."
            }
            required
          />
        </label>
        <Button
          variant="primary"
          type="button"
          onClick={handleGenerate}
          disabled={pending || prompt.trim().length === 0}
        >
          {pending ? "Generating..." : "Generate Pass"}
        </Button>
      </div>
    </Surface>
  );
}
