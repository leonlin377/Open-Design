"use client";

/**
 * Studio Sandpack canvas — WARM-SHELL-001.
 *
 * Wraps `SandpackProvider` + `SandpackPreview` in a Mac-style chrome
 * (red/yellow/green traffic-light dots + URL-like breadcrumb bar) so the
 * live preview doubles as the studio canvas. Viewport width is driven from
 * a three-preset viewport toggle in the topbar.
 *
 * The preview iframe carries the `id="artifact-canvas"` anchor indirectly
 * via the outer frame div so comment-anchor resolution keeps working.
 *
 * STUDIO-SELECTION-001: we inject a small selection shim into the Sandpack
 * virtual filesystem and register the rendered iframe with
 * `SelectionProvider` so selection rects can be translated back into the
 * parent viewport's coordinate space.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  type SandpackPreviewRef
} from "@codesandbox/sandpack-react";
import { useSelectionInternals } from "./selection-context";
import {
  SELECTION_SHIM_IMPORT,
  SELECTION_SHIM_PATH,
  SELECTION_SHIM_SOURCE
} from "./selection-iframe-shim";

export type SandpackViewport = "phone" | "tablet" | "desktop";

export const SANDPACK_VIEWPORT_WIDTHS: Record<SandpackViewport, number> = {
  phone: 390,
  tablet: 834,
  desktop: 1280
};

type StudioSandpackCanvasProps = {
  files: Record<string, string>;
  viewport: SandpackViewport;
  breadcrumb: string;
};

/**
 * Given the user-supplied Sandpack `files` map, layer in the selection
 * shim: (a) write the shim source to `/opendesign-selection.ts` and (b)
 * prepend an import to whichever entry module we can find so the shim runs
 * before React mounts.
 *
 * We prefer `/main.tsx` (Vite default), falling back to `/index.tsx` or
 * `/src/main.tsx`. If none of those exist the shim file is still written
 * but won't auto-install — selection will simply stay null, which is safe.
 */
function withSelectionShim(
  files: Record<string, string>
): Record<string, string> {
  const entryCandidates = [
    "/main.tsx",
    "/index.tsx",
    "/src/main.tsx",
    "/src/index.tsx"
  ];
  const entry = entryCandidates.find((p) => typeof files[p] === "string");
  const next: Record<string, string> = { ...files };
  next[SELECTION_SHIM_PATH] = SELECTION_SHIM_SOURCE;
  if (entry) {
    const original = files[entry] ?? "";
    // Avoid double-prepending on re-renders where `files` was already
    // threaded through us; the import line is unique enough to dedupe on.
    if (!original.includes(SELECTION_SHIM_IMPORT)) {
      next[entry] = `${SELECTION_SHIM_IMPORT}\n${original}`;
    }
  }
  return next;
}

export function StudioSandpackCanvas({
  files,
  viewport,
  breadcrumb
}: StudioSandpackCanvasProps) {
  const width = SANDPACK_VIEWPORT_WIDTHS[viewport];
  const { registerIframe } = useSelectionInternals();
  const previewRef = useRef<SandpackPreviewRef | null>(null);

  // Sandpack wants a stable files object; memo so we don't thrash the session
  // on rerenders that share identical inputs.
  const memoFiles = useMemo(() => withSelectionShim(files), [files]);

  // Resolve the live iframe element after the preview mounts so the
  // selection context can compute parent-viewport offsets.
  useEffect(() => {
    const iframe = previewRef.current?.getClient()?.iframe ?? null;
    registerIframe(iframe);
    return () => registerIframe(null);
  }, [registerIframe, memoFiles]);

  return (
    <div className="studio-sandpack-canvas" data-viewport={viewport}>
      <div
        className="studio-sandpack-chrome"
        style={{ maxWidth: `${width}px` }}
      >
        <div className="studio-sandpack-chrome-bar" aria-hidden>
          <div className="studio-sandpack-dots">
            <span className="studio-sandpack-dot is-red" />
            <span className="studio-sandpack-dot is-yellow" />
            <span className="studio-sandpack-dot is-green" />
          </div>
          <div className="studio-sandpack-url" title={breadcrumb}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>{breadcrumb}</span>
          </div>
        </div>
        <div className="studio-sandpack-surface">
          <SandpackProvider
            template="react-ts"
            files={{
              "/App.tsx": memoFiles["/App.tsx"] ?? "",
              ...(memoFiles["/styles.css"] ? { "/styles.css": memoFiles["/styles.css"] } : {}),
              ...(memoFiles[SELECTION_SHIM_PATH] ? {
                [SELECTION_SHIM_PATH]: memoFiles[SELECTION_SHIM_PATH],
                "/index.tsx": `${SELECTION_SHIM_IMPORT}\nimport React, { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport "./styles.css";\nimport App from "./App";\nconst root = createRoot(document.getElementById("root")!);\nroot.render(<StrictMode><App /></StrictMode>);`
              } : {})
            }}
            options={{
              activeFile: "/App.tsx",
              visibleFiles: ["/App.tsx", ...(memoFiles["/styles.css"] ? ["/styles.css"] : [])],
              externalResources: ["https://cdn.tailwindcss.com"],
              recompileMode: "delayed",
              recompileDelay: 250
            }}
          >
            <SandpackPreview
              ref={previewRef}
              className="studio-sandpack-preview"
              showNavigator={false}
              showRefreshButton={false}
              showRestartButton={false}
              showOpenInCodeSandbox={false}
            />
          </SandpackProvider>
        </div>
      </div>
    </div>
  );
}
