"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Surface } from "@opendesign/ui";

type StudioGeneratePanelProps = {
  projectId: string;
  artifactId: string;
  initialPrompt: string;
};

type GenerationResponse = {
  plan: {
    provider: "litellm" | "heuristic";
    sections: string[];
  };
  generation: {
    provider: "litellm" | "heuristic";
    transport: "stream" | "fallback";
    warning: string | null;
  };
  appendedNodes: Array<{
    id: string;
    type: string;
    name: string;
  }>;
};

function readErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const value = payload.message;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  if (payload && typeof payload === "object" && "error" in payload) {
    const value = payload.error;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

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
          let parsed: unknown = null;

          try {
            parsed = await response.json();
          } catch {
            parsed = null;
          }

          throw new Error(readErrorMessage(parsed, "Artifact generation failed."));
        }

        const payload = (await response.json()) as GenerationResponse;
        const sectionLabel = payload.appendedNodes.length === 1 ? "section" : "sections";

        setFeedback(
          payload.generation.warning
            ? {
                tone: "warning",
                message: `${payload.generation.warning} Generated ${payload.appendedNodes.length} ${sectionLabel} for this pass.`
              }
            : {
                tone: "success",
                message: `Generated ${payload.appendedNodes.length} ${sectionLabel} via LiteLLM and refreshed the Studio workspace.`
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
