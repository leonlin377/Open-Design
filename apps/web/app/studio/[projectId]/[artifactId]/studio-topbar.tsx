"use client";

/**
 * Studio topbar — WARM-SHELL-001 (40px).
 *
 * Elements, left-to-right:
 *   1. Kind glyph (website / prototype / slides)
 *   2. Inline-editable artifact name
 *
 * Right cluster:
 *   3. Viewport toggle (phone / tablet / desktop segmented control)
 *   4. Code / Preview toggle (flips between Sandpack live preview and the
 *      classic CanvasStage)
 *   5. Publish button
 *   6. Overflow menu (remix / share / export) — preserved
 *
 * All state is lifted into the shell via callbacks; the topbar itself
 * stays a presentational component. Composed from `@opendesign/ui`
 * primitives (Inline, Tabs, Tooltip, Button, Popover) so the visual
 * system stays consistent with the rest of the app.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ArtifactKind } from "@opendesign/contracts";
import {
  Button,
  Inline,
  Popover,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip
} from "@opendesign/ui";
import { useT } from "../../../../lib/i18n";
import type { SandpackViewport } from "./studio-sandpack-canvas";

export type CanvasViewMode = "preview" | "scene";

type StudioTopbarProps = {
  projectId: string;
  projectName: string;
  artifactId: string;
  artifactKind: ArtifactKind;
  artifactName: string;
  onRenameArtifact?: (nextName: string) => Promise<void> | void;
  viewport: SandpackViewport;
  onViewportChange: (next: SandpackViewport) => void;
  viewMode: CanvasViewMode;
  onViewModeChange: (next: CanvasViewMode) => void;
  onPublish: () => void;
  extraMenu?: ReactNode;
  conversationOpen?: boolean;
  onConversationToggle?: () => void;
};

const SVG_COMMON = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
};

function KindGlyph({ kind }: { kind: ArtifactKind }) {
  // website → file-text, prototype → workflow, slides → presentation.
  if (kind === "prototype") {
    return (
      <svg {...SVG_COMMON} width={16} height={16}>
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="15" y="15" width="6" height="6" rx="1" />
        <path d="M9 6h3a3 3 0 0 1 3 3v6" />
      </svg>
    );
  }
  if (kind === "slides") {
    return (
      <svg {...SVG_COMMON} width={16} height={16}>
        <rect x="3" y="4" width="18" height="12" rx="1" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    );
  }
  return (
    <svg {...SVG_COMMON} width={16} height={16}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </svg>
  );
}

function IconSmartphone() {
  return (
    <svg {...SVG_COMMON}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
function IconTablet() {
  return (
    <svg {...SVG_COMMON}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg {...SVG_COMMON}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg {...SVG_COMMON}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg {...SVG_COMMON}>
      <path d="m8 17-5-5 5-5M16 7l5 5-5 5" />
    </svg>
  );
}
function OverflowGlyph() {
  return (
    <svg {...SVG_COMMON}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

function kindLabel(kind: ArtifactKind): string {
  if (kind === "prototype") return "Prototype";
  if (kind === "slides") return "Slides";
  return "Website";
}

export function StudioTopbar({
  projectId: _projectId,
  projectName: _projectName,
  artifactId: _artifactId,
  artifactKind,
  artifactName,
  onRenameArtifact,
  viewport,
  onViewportChange,
  viewMode,
  onViewModeChange,
  onPublish,
  extraMenu,
  conversationOpen,
  onConversationToggle
}: StudioTopbarProps) {
  const t = useT();
  const [name, setName] = useState(artifactName);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setName(artifactName);
  }, [artifactName]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commitRename() {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === artifactName) {
      setName(artifactName);
      return;
    }
    if (onRenameArtifact) await onRenameArtifact(trimmed);
  }

  const viewports: ReadonlyArray<{
    id: SandpackViewport;
    label: string;
    Icon: () => ReactNode;
  }> = [
    { id: "phone", label: t("studio.topbar.viewport.phone"), Icon: IconSmartphone },
    { id: "tablet", label: t("studio.topbar.viewport.tablet"), Icon: IconTablet },
    { id: "desktop", label: t("studio.topbar.viewport.desktop"), Icon: IconMonitor }
  ];

  return (
    <Inline
      as="header"
      align="center"
      justify="space-between"
      className="studio-topbar"
      role="banner"
      style={{ gap: 10 }}
    >
      <div className="studio-topbar-left">
        <Tooltip label={kindLabel(artifactKind)}>
          <span className="studio-topbar-glyph" aria-hidden>
            <KindGlyph kind={artifactKind} />
          </span>
        </Tooltip>
        {editing ? (
          <input
            ref={inputRef}
            className="studio-topbar-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") {
                setName(artifactName);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="studio-topbar-name"
            onClick={() => setEditing(true)}
            title={t("studio.topbar.rename.title")}
          >
            {name}
          </button>
        )}
        <span className="studio-topbar-kind" aria-hidden>
          {artifactKind}
        </span>
      </div>
      <div className="studio-topbar-right">
        <Tabs
          value={viewport}
          onValueChange={(next) =>
            onViewportChange(next as SandpackViewport)
          }
          className="studio-topbar-segmented"
          aria-label="Viewport"
        >
          <TabsList
            aria-label="Viewport"
            className="studio-topbar-seg-list"
            style={{ display: "inline-flex", gap: 0 }}
          >
            {viewports.map(({ id, label, Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                title={label}
                aria-label={label}
                className={
                  viewport === id
                    ? "studio-topbar-seg-btn is-active"
                    : "studio-topbar-seg-btn"
                }
              >
                <Icon />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs
          value={viewMode}
          onValueChange={(next) =>
            onViewModeChange(next as CanvasViewMode)
          }
          className="studio-topbar-segmented"
          aria-label="View mode"
        >
          <TabsList
            aria-label="View mode"
            className="studio-topbar-seg-list"
            style={{ display: "inline-flex", gap: 0 }}
          >
            <TabsTrigger
              value="preview"
              title={t("studio.topbar.preview")}
              aria-label={t("studio.topbar.preview")}
              className={
                viewMode === "preview"
                  ? "studio-topbar-seg-btn is-active"
                  : "studio-topbar-seg-btn"
              }
            >
              <IconEye />
            </TabsTrigger>
            <TabsTrigger
              value="scene"
              title="Code / scene"
              aria-label="Code / scene"
              className={
                viewMode === "scene"
                  ? "studio-topbar-seg-btn is-active"
                  : "studio-topbar-seg-btn"
              }
            >
              <IconCode />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {onConversationToggle ? (
          <button
            type="button"
            className={`studio-topbar-conversation-toggle${conversationOpen ? " is-active" : ""}`}
            onClick={onConversationToggle}
            aria-label={t("studio.conversation.toggle")}
            title={t("studio.conversation.toggle")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          className="studio-topbar-publish"
          onClick={onPublish}
        >
          Publish
          <span aria-hidden>→</span>
        </Button>
        <div className="studio-topbar-menu">
          <button
            type="button"
            ref={menuTriggerRef}
            className="studio-topbar-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen ? "true" : "false"}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={t("studio.topbar.menu.title")}
            title={t("studio.topbar.menu.title")}
          >
            <OverflowGlyph />
          </button>
          <Popover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchor={menuTriggerRef}
            placement="bottom-end"
            ariaLabel={t("studio.topbar.menu.title")}
          >
            <div
              className="studio-topbar-menu-items"
              role="menu"
              onClick={() => setMenuOpen(false)}
            >
              {extraMenu}
            </div>
          </Popover>
        </div>
      </div>
    </Inline>
  );
}
