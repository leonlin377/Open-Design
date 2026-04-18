"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Surface } from "@opendesign/ui";
import type { ApiArtifactGenerateResponse } from "../lib/opendesign-api";
import { buildApiRequestError } from "../lib/api-errors";

type StudioGeneratePanelProps = {
  projectId: string;
  artifactId: string;
  initialPrompt: string;
};

export function StudioGeneratePanel({
  projectId,
  artifactId,
  initialPrompt
}: StudioGeneratePanelProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);
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

        const response = await fetch(
          `${apiOrigin}/api/projects/${projectId}/artifacts/${artifactId}/generate`,
          {
            method: "POST",
            credentials: "include",
            headers: {
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

        const payload = (await response.json()) as ApiArtifactGenerateResponse;
        const appendedNodeCount = payload.generation.scenePatch.appendedNodes.length;
        const sectionLabel = appendedNodeCount === 1 ? "section" : "sections";

        setFeedback(
          payload.generation.diagnostics.warning
            ? {
                tone: "warning",
                message: `${payload.generation.diagnostics.warning} Generated ${appendedNodeCount} ${sectionLabel} for this pass.`
              }
            : {
                tone: "success",
                message: `Generated ${appendedNodeCount} ${sectionLabel} via ${payload.generation.plan.provider} and refreshed the Studio workspace.`
              }
        );
        router.refresh();
      } catch (error) {
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
        <h3>Generate Artifact</h3>
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
            ? "Waiting for the generation pass to finish and refresh the workspace."
            : "A completed pass appends new scene sections and creates a prompt snapshot."}
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
            placeholder="Design a cinematic launch surface with a strong hero, proof points, and a conversion CTA."
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
