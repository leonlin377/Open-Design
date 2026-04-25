"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Inline, Surface } from "@opendesign/ui";
import type { ApiArtifact } from "../lib/opendesign-api";
import { buildApiRequestError } from "../lib/api-errors";
import { consumeGenerationStream, type GenerateRetryHandle } from "../lib/opendesign-generate";
import { getArtifactEditorAffordance } from "./studio-artifact-affordances";
import { useT } from "../lib/i18n";

type StudioGeneratePanelProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ApiArtifact["kind"];
  initialPrompt: string;
  autoGeneratePrompt?: string;
};

export function StudioGeneratePanel({
  projectId,
  artifactId,
  artifactKind,
  initialPrompt,
  autoGeneratePrompt
}: StudioGeneratePanelProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(autoGeneratePrompt || initialPrompt);
  const [pending, startTransition] = useTransition();
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [retryHandle, setRetryHandle] = useState<GenerateRetryHandle>(null);
  const [cancelling, setCancelling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoFiredRef = useRef(false);
  const t = useT();
  const affordance = getArtifactEditorAffordance(artifactKind);
  const unitPluralLabel = `${affordance.unitLabel}s`;
  const apiOrigin = useMemo(
    () => process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000",
    []
  );

  useEffect(() => {
    if (!autoGeneratePrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt, autoGeneratePrompt]);

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
          setProgressMessage(t("studio.generate.connecting"));

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
                  message: t("studio.generate.success.warning", {
                    warning: outcome.payload.generation.diagnostics.warning,
                    count: String(appendedNodeCount),
                    unit: unitLabel
                  })
                }
              : {
                  tone: "success",
                  message: t("studio.generate.success", {
                    count: String(appendedNodeCount),
                    unit: unitLabel
                  })
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
              message: t("studio.generate.cancelled")
            });
            setRetryHandle({ retryable: true, prompt: promptToUse });
            return;
          }
          setFeedback({
            tone: "error",
            message:
              error instanceof Error ? error.message : t("studio.generate.error.default")
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

  useEffect(() => {
    if (autoGeneratePrompt && !autoFiredRef.current) {
      autoFiredRef.current = true;
      const timer = setTimeout(() => {
        runGeneration(autoGeneratePrompt);
        const url = new URL(window.location.href);
        url.searchParams.delete("quickPrompt");
        window.history.replaceState(null, "", url.toString());
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoGeneratePrompt, runGeneration]);

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
        <h3>{t("studio.generate.title")}</h3>
        <p className="footer-note">{t("studio.generate.description")}</p>
      </div>
      <div className="studio-status-row">
        <span className={pending ? "status-pill warning" : "status-pill success"}>
          {pending
            ? (cancelling ? t("studio.generate.status.cancelling") : t("studio.generate.status.generating"))
            : t("studio.generate.status.ready")}
        </span>
        <span className="footer-note">
          {pending
            ? progressMessage ?? t("studio.generate.waiting")
            : null}
        </span>
      </div>
      {!pending ? (
        <Inline gap={2} wrap className="studio-generate-suggestions">
          {affordance.starterPrompts.map((sp) => (
            <Chip
              key={sp}
              tone="outline"
              onClick={() => {
                setPrompt(sp);
              }}
              className="studio-generate-suggestion-chip"
            >
              {sp.length > 60 ? `${sp.slice(0, 57)}...` : sp}
            </Chip>
          ))}
        </Inline>
      ) : null}
      {feedback ? (
        <div className={`studio-feedback ${feedback.tone}`}>{feedback.message}</div>
      ) : null}
      <div className="stack-form">
        <label className="field">
          <span>{t("studio.generate.prompt.label")}</span>
          <textarea
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={affordance.starterPrompts[0]}
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
            {pending
              ? (cancelling ? t("studio.generate.button.cancelling") : t("studio.generate.button.generating"))
              : t("studio.generate.button")}
          </Button>
          {pending ? (
            <Button
              variant="outline"
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? t("studio.generate.button.cancelling") : t("studio.generate.cancel")}
            </Button>
          ) : retryHandle?.retryable ? (
            <Button variant="outline" type="button" onClick={handleRetry}>
              {t("studio.generate.retry")}
            </Button>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
