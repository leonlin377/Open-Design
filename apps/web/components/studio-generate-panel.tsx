"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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

type RetryHandle =
  | { retryable: true; prompt: string; designSystemPackId?: string }
  | { retryable: false }
  | null;

async function readGenerationEventStream(
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

type StreamOutcome =
  | { kind: "completed"; payload: ApiArtifactGenerateResponse }
  | { kind: "failed"; message: string; retry: RetryHandle };

async function consumeGenerationStream(
  response: Response,
  onProgress: (message: string) => void,
  signal: AbortSignal
): Promise<StreamOutcome> {
  let completedPayload: ApiArtifactGenerateResponse | null = null;
  let failureMessage: string | null = null;
  let retry: RetryHandle = null;

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
  const [retryHandle, setRetryHandle] = useState<RetryHandle>(null);
  const [cancelling, setCancelling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const affordance = getArtifactEditorAffordance(artifactKind);
  const unitPluralLabel = `${affordance.unitLabel}s`;
  const apiOrigin = useMemo(
    () => process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000",
    []
  );

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const runGeneration = useCallback(
    (promptToUse: string) => {
      startTransition(async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
          setFeedback(null);
          setRetryHandle(null);
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
              body: JSON.stringify({ prompt: promptToUse }),
              signal: controller.signal
            }
          );

          if (!response.ok) {
            throw await buildApiRequestError(response, "Artifact generation failed.");
          }

          const outcome = await consumeGenerationStream(
            response,
            (message) => setProgressMessage(message),
            controller.signal
          );

          if (outcome.kind === "failed") {
            setRetryHandle(outcome.retry);
            setFeedback({ tone: "error", message: outcome.message });
            setProgressMessage(null);
            return;
          }

          const appendedNodeCount =
            outcome.payload.generation.scenePatch.appendedNodes.length;
          const unitLabel =
            appendedNodeCount === 1
              ? affordance.unitLabel
              : `${affordance.unitLabel}s`;

          setFeedback(
            outcome.payload.generation.diagnostics.warning
              ? {
                  tone: "warning",
                  message: `${outcome.payload.generation.diagnostics.warning} Generated ${appendedNodeCount} ${unitLabel} for this pass.`
                }
              : {
                  tone: "success",
                  message: `Generated ${appendedNodeCount} ${unitLabel} via ${outcome.payload.generation.plan.provider} and refreshed the Studio workspace.`
                }
          );
          setRetryHandle(null);
          setProgressMessage(null);
          router.refresh();
        } catch (error) {
          setProgressMessage(null);
          if (controller.signal.aborted) {
            setFeedback({
              tone: "warning",
              message: "Generation cancelled."
            });
            setRetryHandle({ retryable: true, prompt: promptToUse });
            return;
          }
          setFeedback({
            tone: "error",
            message:
              error instanceof Error ? error.message : "Artifact generation failed."
          });
        } finally {
          setCancelling(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      });
    },
    [affordance.unitLabel, apiOrigin, artifactId, projectId, router]
  );

  async function handleCancel() {
    if (!pending || cancelling) {
      return;
    }
    setCancelling(true);
    try {
      // Server-side cancel — aborts the upstream fetch and emits a failed
      // event on the stream. We also abort the local fetch to drop the socket.
      await fetch(
        `${apiOrigin}/api/projects/${projectId}/artifacts/${artifactId}/generate/cancel`,
        {
          method: "POST",
          credentials: "include"
        }
      ).catch(() => {
        /* ignored — the local abort below still ends the stream */
      });
    } finally {
      abortControllerRef.current?.abort();
    }
  }

  function handleRetry() {
    if (!retryHandle?.retryable) {
      return;
    }
    runGeneration(retryHandle.prompt);
  }

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>Generate {artifactKind === "slides" ? "Deck" : artifactKind === "prototype" ? "Flow" : "Artifact"}</h3>
        <p className="footer-note">
          Send a prompt into the generation pipeline. LiteLLM streams are used when
          configured; otherwise the backend falls back to the local heuristic planner.
          Cancel an in-flight pass or retry a recoverable failure without retyping.
        </p>
      </div>
      <div className="studio-status-row">
        <span className={pending ? "status-pill warning" : "status-pill success"}>
          {pending ? (cancelling ? "Cancelling" : "Generating") : "Ready"}
        </span>
        <span className="footer-note">
          {pending
            ? progressMessage ?? "Waiting for the pass to finish and refresh the workspace."
            : `A completed pass appends new ${unitPluralLabel} and creates a prompt snapshot.`}
        </span>
      </div>
      {!pending ? (
        <Surface className="kv" as="section">
          <span>Suggested prompts</span>
          {affordance.starterPrompts.join(" · ")}
        </Surface>
      ) : null}
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
        <div className="studio-generate-actions">
          <Button
            variant="primary"
            type="button"
            onClick={() => runGeneration(prompt)}
            disabled={pending || prompt.trim().length === 0}
          >
            {pending ? (cancelling ? "Cancelling…" : "Generating…") : "Generate Pass"}
          </Button>
          {pending ? (
            <Button
              variant="outline"
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </Button>
          ) : retryHandle?.retryable ? (
            <Button variant="outline" type="button" onClick={handleRetry}>
              Retry last prompt
            </Button>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
