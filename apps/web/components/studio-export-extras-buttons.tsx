"use client";

import { useState } from "react";

/**
 * Two-button control surface for the newer Claude-Design-parity exporters:
 * Figma plugin JSON + CodeSandbox-ready ZIP.
 *
 * This component is intentionally decoupled from the primary export panel
 * (which is owned by the design-system agent) — the main thread is expected
 * to drop it wherever the export UI lives.
 */

type StudioExportExtrasButtonsProps = {
  projectId: string;
  artifactId: string;
  /**
   * Optional base URL override. Defaults to relative API paths so the
   * Next.js rewrites / same-origin deployment path is used.
   */
  apiBaseUrl?: string;
  className?: string;
};

type ExportState =
  | { status: "idle" }
  | { status: "busy"; kind: "figma" | "codesandbox" }
  | { status: "error"; kind: "figma" | "codesandbox"; message: string };

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Release the object URL on the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function StudioExportExtrasButtons({
  projectId,
  artifactId,
  apiBaseUrl = "/api",
  className
}: StudioExportExtrasButtonsProps) {
  const [state, setState] = useState<ExportState>({ status: "idle" });

  const runExport = async (kind: "figma" | "codesandbox") => {
    setState({ status: "busy", kind });
    try {
      const endpoint =
        kind === "figma" ? "figma-import" : "codesandbox";
      const response = await fetch(
        `${apiBaseUrl}/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(
          artifactId
        )}/exports/${endpoint}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: kind === "figma" ? JSON.stringify({}) : undefined
        }
      );

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(
          `Export failed (${response.status})${bodyText ? `: ${bodyText}` : ""}`
        );
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const fallbackFilename =
        kind === "figma" ? "artifact-figma.json" : "artifact-codesandbox.zip";
      const filename = filenameMatch?.[1] ?? fallbackFilename;

      const blob = await response.blob();
      triggerDownload(filename, blob);
      setState({ status: "idle" });
    } catch (error) {
      setState({
        status: "error",
        kind,
        message:
          error instanceof Error ? error.message : "Unknown export error"
      });
    }
  };

  const busyKind = state.status === "busy" ? state.kind : null;

  return (
    <div
      className={className ?? "artifact-action-grid"}
      data-testid="studio-export-extras-buttons"
    >
      <button
        type="button"
        className="button-link ghost"
        disabled={busyKind !== null}
        onClick={() => void runExport("figma")}
      >
        {busyKind === "figma"
          ? "Building Figma JSON…"
          : "Download Figma Import JSON"}
      </button>
      <button
        type="button"
        className="button-link ghost"
        disabled={busyKind !== null}
        onClick={() => void runExport("codesandbox")}
      >
        {busyKind === "codesandbox"
          ? "Building CodeSandbox ZIP…"
          : "Download CodeSandbox ZIP"}
      </button>
      {state.status === "error" ? (
        <div className="footer-note" role="alert">
          {state.kind === "figma" ? "Figma" : "CodeSandbox"} export failed:{" "}
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
