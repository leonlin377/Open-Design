"use client";

import type { ReactNode } from "react";

export type CanvasTool = "select" | "pan";

export type CanvasToolbarProps = {
  zoom: number;
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFit: () => void;
  themeSlot?: ReactNode;
};

export function CanvasToolbar({
  zoom,
  tool,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFit,
  themeSlot
}: CanvasToolbarProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas controls">
      <div className="canvas-toolbar-group" role="radiogroup" aria-label="Active tool">
        <button
          type="button"
          role="radio"
          aria-checked={tool === "select"}
          className={`canvas-toolbar-btn ${tool === "select" ? "is-active" : ""}`}
          onClick={() => onToolChange("select")}
          title="Selection tool (V)"
        >
          Select
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tool === "pan"}
          className={`canvas-toolbar-btn ${tool === "pan" ? "is-active" : ""}`}
          onClick={() => onToolChange("pan")}
          title="Pan tool (H)"
        >
          Pan
        </button>
      </div>
      <div className="canvas-toolbar-group" aria-label="Zoom controls">
        <button
          type="button"
          className="canvas-toolbar-btn"
          onClick={onZoomOut}
          title="Zoom out (Ctrl/Cmd + -)"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="canvas-toolbar-btn canvas-toolbar-zoom-readout"
          onClick={onZoomReset}
          title="Reset zoom (0)"
          aria-label={`Current zoom ${zoomPercent}%. Click to reset to 100%.`}
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          className="canvas-toolbar-btn"
          onClick={onZoomIn}
          title="Zoom in (Ctrl/Cmd + +)"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="canvas-toolbar-btn"
          onClick={onFit}
          title="Fit content to viewport (F)"
        >
          Fit
        </button>
      </div>
      {themeSlot ? <div className="canvas-toolbar-slot">{themeSlot}</div> : null}
    </div>
  );
}
