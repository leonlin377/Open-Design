"use client";

/**
 * Studio shell — WARM-SHELL-001 rebuild.
 *
 * Layout:
 *
 *   +-----------------------------------------------------+
 *   | topbar (40px)                                       |
 *   +---------+-------------------------------------------+
 *   | chat    |                                           |
 *   | column  |   canvas (Sandpack live preview OR the    |
 *   | 320px   |   classic CanvasStage in "scene" mode)    |
 *   |         |                                           |
 *   | (bottom-| - inline refine bubble floats when a node |
 *   |  icons +  is selected                                |
 *   |  popover)                                           |
 *   +---------+-------------------------------------------+
 *
 *   No right rail. Resource popover floats above the chat column's
 *   bottom-left icon buttons.
 */

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { Text } from "@opendesign/ui";
import { useT } from "../../../../lib/i18n";
import { StudioChatColumn } from "./studio-chat-column";
import {
  StudioSandpackCanvas,
  type SandpackViewport
} from "./studio-sandpack-canvas";
import { StudioInlineRefineBubble } from "./studio-inline-refine-bubble";
import { StudioTopbar, type CanvasViewMode } from "./studio-topbar";
import { SelectionProvider, useSelection } from "./selection-context";
import type { ArtifactKind } from "@opendesign/contracts";

// --- Client publish helper --------------------------------------------------
// `lib/opendesign-api.ts` is tagged `server-only`, so we can't import from it
// in this client module. We duplicate just the tiny slice needed for the
// Publish flow: snapshot a labeled version, optionally mint a share token,
// and fall back to the handoff-bundle export route when the share API is not
// available yet.
function resolvePublishApiOrigin(): string {
  if (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_API_ORIGIN === "string" &&
    process.env.NEXT_PUBLIC_API_ORIGIN.length > 0
  ) {
    return process.env.NEXT_PUBLIC_API_ORIGIN;
  }
  return "http://127.0.0.1:4000";
}

function resolvePublishShareHost(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://127.0.0.1:3100";
}

type PublishOutcome =
  | { kind: "published"; shareUrl: string; versionId: string }
  | { kind: "fallback"; fallbackUrl: string; versionId: string };

async function publishArtifactSnapshot(input: {
  projectId: string;
  artifactId: string;
  fallbackUrl: string;
}): Promise<PublishOutcome> {
  const origin = resolvePublishApiOrigin();
  const label = `publish-${new Date().toISOString()}`;

  // 1. Snapshot the current scene as a labeled version.
  const versionRes = await fetch(
    `${origin}/api/projects/${input.projectId}/artifacts/${input.artifactId}/versions`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, summary: "Hosted preview snapshot" })
    }
  );
  if (!versionRes.ok) {
    const text = await versionRes.text().catch(() => "");
    throw new Error(
      `Failed to snapshot version (${versionRes.status})${text ? `: ${text}` : ""}`
    );
  }
  const versionJson = (await versionRes.json().catch(() => ({}))) as {
    id?: string;
  };
  const versionId = versionJson.id ?? "";

  // 2. Mint a viewer share token so the preview is reachable.
  try {
    const shareRes = await fetch(
      `${origin}/api/projects/${input.projectId}/artifacts/${input.artifactId}/share-tokens`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "viewer" })
      }
    );
    if (shareRes.ok) {
      const payload = (await shareRes.json().catch(() => ({}))) as {
        share?: { token?: string };
        sharePath?: string;
      };
      const token = payload.share?.token;
      if (token) {
        return {
          kind: "published",
          shareUrl: `${resolvePublishShareHost()}/share/${token}`,
          versionId
        };
      }
    }
  } catch {
    // Intentional fall-through to fallback below.
  }

  return { kind: "fallback", fallbackUrl: input.fallbackUrl, versionId };
}

type StudioShellProps = {
  storageKey: string;
  projectId: string;
  artifactId: string;
  artifactKind: ArtifactKind;
  artifactName: string;
  /** Breadcrumb shown in the Mac chrome URL bar. */
  canvasBreadcrumb: string;
  /** Sandpack files for live-preview mode. */
  codeWorkspaceFiles: Record<string, string>;
  /** Classic scene stage (fallback when viewMode === "scene"). */
  sceneCanvas: ReactNode;
  /** Chat transcript area (StudioChatPanel already pre-wired). */
  chatPanel: ReactNode;
  /** Composer panels mounted inside the chat column. */
  composePanels: {
    promptPanel: ReactNode;
    variationsPanel: ReactNode;
    refinePanel: ReactNode | null;
  };
  /** Resource popover slots. */
  resourcePanels: {
    layersPanel: ReactNode;
    designSystemPanel: ReactNode;
    palettePanel: ReactNode;
    versionsPanel: ReactNode;
    exportPanel: ReactNode;
    commentsPanel: ReactNode;
  };
  /** Extra overflow menu rendered from the server (remix / export / share). */
  topbarExtraMenu: ReactNode;
  /** Publish URL fallback — launched in a new tab. */
  publishHref: string;
};

const LOCAL_VIEWPORT_KEY = (k: string) =>
  `opendesign:studio:viewport:${k}`;
const LOCAL_VIEW_MODE_KEY = (k: string) =>
  `opendesign:studio:view-mode:${k}`;

export function StudioShell(props: StudioShellProps) {
  return (
    <SelectionProvider>
      <StudioShellInner {...props} />
    </SelectionProvider>
  );
}

/**
 * Parent-side selection outline — mirrors the iframe-side moss outline into
 * the host document so the selection stays visible even when the iframe is
 * scaled, overlapped by other layers, or sitting on a zoomed viewport.
 *
 * We re-read `getViewportRect()` on every animation frame to stay in sync
 * with iframe scroll / resize without subscribing to an event bus. The draw
 * is O(1) — a single fixed-position <div> — so the rAF loop is cheap.
 */
function ParentSelectionOverlay() {
  const t = useT();
  const { getViewportRect, selected } = useSelection();
  const [rect, setRect] = useState<
    { top: number; left: number; width: number; height: number } | null
  >(null);

  useEffect(() => {
    if (!selected) {
      setRect(null);
      return;
    }
    let handle = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const next = getViewportRect();
      setRect((prev) => {
        if (!next) return null;
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
      handle = window.requestAnimationFrame(tick);
    };
    handle = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (handle) window.cancelAnimationFrame(handle);
    };
  }, [selected, getViewportRect]);

  if (!rect) return null;
  return (
    <div
      aria-hidden="true"
      aria-label={t("studio.selection.overlay.label")}
      className="studio-selection-overlay"
      style={{
        position: "fixed",
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: "2px solid #C87E4F",
        borderRadius: 2,
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: 40
      }}
    />
  );
}

type ToastState =
  | { tone: "success"; title: string; description: string; href?: string }
  | { tone: "error"; title: string; description: string }
  | null;

/**
 * Minimal toast used by the Publish flow. We can't mount the shared
 * `<ToastProvider>` because the studio route doesn't own it, but this is
 * self-contained and visually consistent with the rest of the shell.
 */
function StudioToastBanner({
  toast,
  onDismiss,
  dismissLabel,
  openLabel
}: {
  toast: ToastState;
  onDismiss: () => void;
  dismissLabel: string;
  openLabel: string;
}) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="studio-publish-toast"
      data-tone={toast.tone}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        maxWidth: 360,
        padding: "10px 12px",
        borderRadius: 6,
        background:
          toast.tone === "success" ? "rgba(62,107,92,0.95)" : "rgba(150,50,40,0.95)",
        color: "#FFFEF9",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        fontSize: 13,
        lineHeight: 1.4,
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}
    >
      <strong>{toast.title}</strong>
      <span>{toast.description}</span>
      <div style={{ display: "flex", gap: 8 }}>
        {toast.tone === "success" && toast.href ? (
          <a
            href={toast.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#FFFEF9", textDecoration: "underline" }}
          >
            {openLabel}
          </a>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          style={{
            marginLeft: "auto",
            background: "transparent",
            color: "inherit",
            border: "1px solid rgba(255,254,249,0.5)",
            borderRadius: 4,
            padding: "2px 6px",
            cursor: "pointer"
          }}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}

function StudioShellInner({
  storageKey,
  projectId,
  artifactId,
  artifactKind,
  artifactName,
  canvasBreadcrumb,
  codeWorkspaceFiles,
  sceneCanvas,
  chatPanel,
  composePanels,
  resourcePanels,
  topbarExtraMenu,
  publishHref
}: StudioShellProps) {
  const t = useT();
  const { selected } = useSelection();
  const selectedNodeId = selected?.nodeId || null;
  const selectedNodeName = selected?.textPreview || selected?.elementTag || null;
  const [viewport, setViewport] = useState<SandpackViewport>("desktop");
  const [viewMode, setViewMode] = useState<CanvasViewMode>("preview");
  const [refineOpen, setRefineOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [publishing, setPublishing] = useState(false);

  // Restore persisted toggles.
  useEffect(() => {
    try {
      const vp = window.localStorage.getItem(LOCAL_VIEWPORT_KEY(storageKey));
      if (vp === "phone" || vp === "tablet" || vp === "desktop") setViewport(vp);
      const vm = window.localStorage.getItem(LOCAL_VIEW_MODE_KEY(storageKey));
      if (vm === "preview" || vm === "scene") setViewMode(vm);
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_VIEWPORT_KEY(storageKey), viewport);
    } catch {
      // ignore
    }
  }, [viewport, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_VIEW_MODE_KEY(storageKey), viewMode);
    } catch {
      // ignore
    }
  }, [viewMode, storageKey]);

  // When selection clears, close the refine bubble.
  useEffect(() => {
    if (!selectedNodeId) setRefineOpen(false);
  }, [selectedNodeId]);

  const handlePublish = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (publishing) return;
    const confirmed = window.confirm(t("studio.publish.confirm"));
    if (!confirmed) return;
    setPublishing(true);
    try {
      const outcome = await publishArtifactSnapshot({
        projectId,
        artifactId,
        fallbackUrl: publishHref
      });
      if (outcome.kind === "published") {
        setToast({
          tone: "success",
          title: t("studio.publish.success.title"),
          description: t("studio.publish.success.description", {
            url: outcome.shareUrl
          }),
          href: outcome.shareUrl
        });
      } else if (outcome.kind === "fallback") {
        // Real share token unavailable — we created the snapshot version but
        // have nothing shareable yet, so fall back to the handoff-bundle URL.
        setToast({
          tone: "success",
          title: t("studio.publish.success.title"),
          description: t("studio.publish.success.description", {
            url: outcome.fallbackUrl
          }),
          href: outcome.fallbackUrl
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("studio.publish.error.generic");
      setToast({
        tone: "error",
        title: t("studio.publish.error.title"),
        description: message
      });
      // Fall back to opening the source-bundle so the button is never a dead-end.
      try {
        window.open(publishHref, "_blank", "noopener,noreferrer");
      } catch {
        // ignore popup blockers
      }
    } finally {
      setPublishing(false);
    }
  }, [publishing, publishHref, projectId, artifactId, t]);

  const topbar = (
    <StudioTopbar
      projectId={projectId}
      projectName=""
      artifactId={artifactId}
      artifactKind={artifactKind}
      artifactName={artifactName}
      viewport={viewport}
      onViewportChange={setViewport}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onPublish={handlePublish}
      extraMenu={topbarExtraMenu}
    />
  );

  return (
    <main className="studio-shell-v2">
      {topbar}
      <div className="studio-shell-body">
        <StudioChatColumn
          storageKey={storageKey}
          promptPanel={composePanels.promptPanel}
          variationsPanel={composePanels.variationsPanel}
          refinePanel={composePanels.refinePanel}
          resourcePanels={resourcePanels}
        >
          {chatPanel}
        </StudioChatColumn>

        <section
          className="studio-canvas-region"
          aria-label={t("studio.canvas.label")}
        >
          {/* id="artifact-canvas" anchor lives on this outer wrapper so
              comment-anchor resolution continues to land at a stable DOM
              node regardless of which view mode is currently active. */}
          <div
            className="studio-canvas-surface"
            id="artifact-canvas"
            data-view-mode={viewMode}
          >
            {viewMode === "preview" ? (
              <StudioSandpackCanvas
                files={codeWorkspaceFiles}
                viewport={viewport}
                breadcrumb={canvasBreadcrumb}
              />
            ) : (
              sceneCanvas
            )}
            {selectedNodeId && !refineOpen ? (
              <button
                type="button"
                className="studio-inline-refine-trigger"
                onClick={() => setRefineOpen(true)}
              >
                <Text as="span" variant="body-s">
                  Refine selection
                </Text>
              </button>
            ) : null}
            {selectedNodeId && refineOpen ? (
              <StudioInlineRefineBubble
                projectId={projectId}
                artifactId={artifactId}
                nodeId={selectedNodeId}
                nodeName={selectedNodeName ?? undefined}
                onClose={() => setRefineOpen(false)}
              />
            ) : null}
          </div>
        </section>
      </div>
      <ParentSelectionOverlay />
      <StudioToastBanner
        toast={toast}
        onDismiss={() => setToast(null)}
        dismissLabel={t("studio.publish.toast.dismiss")}
        openLabel={t("studio.publish.share.open")}
      />
    </main>
  );
}
