"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Surface } from "@opendesign/ui";
import {
  streamRefineNode,
  type ArtifactRefineStreamEvent
} from "../lib/opendesign-generation-extras";

type StudioRefinePopoverProps = {
  projectId: string;
  artifactId: string;
  nodeId: string;
  nodeName?: string;
  onClose?: () => void;
};

/**
 * Small popover attached to a selected scene node. Submits an instruction
 * (e.g. "Refine in a bolder tone") and streams the refine SSE events inline.
 * Commit is atomic on the server — a successful "completed" event means the
 * scene document is updated.
 */
export function StudioRefinePopover({
  projectId,
  artifactId,
  nodeId,
  nodeName,
  onClose
}: StudioRefinePopoverProps) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("Refine in a bolder tone");
  const [progress, setProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      setProgress("Starting refine…");
      setFeedback(null);
      try {
        await streamRefineNode({
          projectId,
          artifactId,
          nodeId,
          instruction,
          onEvent: (event: ArtifactRefineStreamEvent) => {
            if (event.type === "started" || event.type === "planning" || event.type === "applying") {
              setProgress(event.message);
              return;
            }
            if (event.type === "completed") {
              setProgress(null);
              setFeedback({ tone: "success", message: event.message });
              router.refresh();
              return;
            }
            if (event.type === "failed") {
              setProgress(null);
              setFeedback({ tone: "error", message: event.message });
              return;
            }
          }
        });
      } catch (error) {
        setProgress(null);
        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Refine stream failed."
        });
      }
    });
  }

  return (
    <Surface className="studio-refine-popover" as="section">
      <header>
        <strong>Refine{nodeName ? `: ${nodeName}` : ""}</strong>
        {onClose ? (
          <Button variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </header>
      <label className="field">
        <span>Instruction</span>
        <input
          type="text"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Refine in a bolder tone…"
        />
      </label>
      <div className="studio-generate-actions">
        <Button
          variant="primary"
          type="button"
          onClick={handleSubmit}
          disabled={pending || instruction.trim().length === 0}
        >
          {pending ? "Refining..." : "Apply refine"}
        </Button>
      </div>
      {progress ? <div className="studio-feedback">{progress}</div> : null}
      {feedback ? (
        <div className={`studio-feedback ${feedback.tone}`}>{feedback.message}</div>
      ) : null}
    </Surface>
  );
}
