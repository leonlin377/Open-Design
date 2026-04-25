"use client";

import type { StudioThreadMessage } from "../app/studio/[projectId]/[artifactId]/use-studio-thread";

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636 5.636 18.364" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
    </svg>
  );
}

export function StudioMessageBubble({
  message
}: {
  message: StudioThreadMessage;
}) {
  const { kind, content, meta } = message;

  if (kind === "user") {
    return (
      <div className="studio-msg studio-msg-user">
        <div className="studio-msg-content">{content}</div>
      </div>
    );
  }

  if (kind === "assistant") {
    return (
      <div
        className="studio-msg studio-msg-assistant"
        data-tone={meta?.tone ?? undefined}
      >
        <div className="studio-msg-content">{content}</div>
      </div>
    );
  }

  if (kind === "generate-result") {
    return (
      <div
        className="studio-msg studio-msg-result"
        data-tone={meta?.tone ?? "success"}
      >
        <SparkleIcon />
        <span>{content}</span>
      </div>
    );
  }

  if (kind === "refine-result") {
    return (
      <div
        className="studio-msg studio-msg-result"
        data-tone={meta?.tone ?? "success"}
      >
        <WandIcon />
        <span>{content}</span>
      </div>
    );
  }

  if (kind === "progress") {
    return (
      <div className="studio-msg studio-msg-progress">
        <div className="studio-msg-progress-dots" aria-label="Working">
          <span />
          <span />
          <span />
        </div>
        <span>{content}</span>
      </div>
    );
  }

  return null;
}
