"use client";

import type { ReactNode } from "react";

export type CanvasEmptyStateProps = {
  title: string;
  description: string;
  unitLabel: string;
  actions?: ReactNode;
};

export function CanvasEmptyState({
  title,
  description,
  unitLabel,
  actions
}: CanvasEmptyStateProps) {
  return (
    <div className="canvas-empty-state" role="status">
      <div className="canvas-empty-state-art" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="canvas-empty-state-copy">
        <strong>{title}</strong>
        <p>{description}</p>
        <p className="canvas-empty-state-hint">
          Use the <em>{unitLabel}</em> actions in the sections panel below to append
          the first block, then double-click any text on the canvas to edit it.
        </p>
      </div>
      {actions ? <div className="canvas-empty-state-actions">{actions}</div> : null}
    </div>
  );
}
