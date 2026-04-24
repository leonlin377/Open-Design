"use client";

/**
 * Studio chat column — WARM-SHELL-001.
 *
 * Permanent left-docked column (320px wide) that replaces the former right
 * drawer. It owns:
 *   - The chat transcript (hosting the provided `chatPanel` as `children`
 *     for the scrollable message list area).
 *   - A tabbed composer at the bottom (Prompt / Variations / Refine) that
 *     receives the existing prompt / variations / refine panels and toggles
 *     between them.
 *   - Two icon buttons at the bottom-left (layers + clock) which open the
 *     resource popover.
 *
 * Selection-aware: if `selectedNodeId` is null, the Refine tab is disabled.
 * Panel internals are preserved verbatim — we only choose which slot is
 * visible.
 */

import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { ChatSelectedNode } from "@opendesign/contracts/src/chat";
import { useT } from "../../../../lib/i18n";
import { StudioResourcePopover } from "./studio-resource-popover";
import { useSelection, type SelectedNode } from "./selection-context";

export type ComposeTabId = "prompt" | "variations" | "refine";

export type ChatColumnResourcePanels = {
  layersPanel: ReactNode;
  designSystemPanel: ReactNode;
  palettePanel: ReactNode;
  versionsPanel: ReactNode;
  exportPanel: ReactNode;
  commentsPanel: ReactNode;
};

type StudioChatColumnProps = {
  storageKey: string;
  /** Transcript / header area — caller provides a StudioChatPanel. */
  children: ReactNode;
  /** Bottom composer tabs. */
  promptPanel: ReactNode;
  variationsPanel: ReactNode;
  refinePanel: ReactNode | null;
  /** Resource popover panels. */
  resourcePanels: ChatColumnResourcePanels;
};

// -----------------------------------------------------------------------
// Inline lucide-style outline glyphs (1.5 stroke, currentColor).
// -----------------------------------------------------------------------

const SVG_COMMON = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
};

// lucide "layers"
function IconLayers() {
  return (
    <svg {...SVG_COMMON}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

// lucide "clock"
function IconClock() {
  return (
    <svg {...SVG_COMMON}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/**
 * Translate the selection-context shape (iframe-reported DOM selection) into
 * the `ChatSelectedNode` envelope the chat contract expects. Chat's contract
 * requires non-empty `nodeId`, `nodeName`, and `nodeType` strings, so we
 * only thread a node through when all three resolve.
 */
function toChatSelectedNode(
  selected: SelectedNode | null
): ChatSelectedNode | null {
  if (!selected) return null;
  const nodeId = selected.nodeId.trim();
  const nodeType = selected.elementTag.trim() || "element";
  const nodeName =
    selected.textPreview.trim() || selected.elementTag.trim() || "Element";
  if (!nodeId) return null;
  return { nodeId, nodeName, nodeType };
}

export function StudioChatColumn({
  storageKey,
  children,
  promptPanel,
  variationsPanel,
  refinePanel,
  resourcePanels
}: StudioChatColumnProps) {
  const t = useT();
  const { selected } = useSelection();
  const selectedNodeId = selected?.nodeId || null;
  const chatSelectedNode = useMemo(
    () => toChatSelectedNode(selected),
    [selected]
  );
  // Clone the parent-provided chat panel element and override its
  // `selectedNode` prop so the "Ask about selected element" checkbox has a
  // real pointer to thread through to `sendChatMessage`. When the caller
  // passes something that isn't a valid element, render it as-is.
  const chatContent = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ selectedNode?: ChatSelectedNode | null }>, {
        selectedNode: chatSelectedNode
      })
    : children;
  const tabKey = `opendesign:studio:chat-compose-tab:${storageKey}`;
  const [active, setActive] = useState<ComposeTabId>("prompt");
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [popoverGroup, setPopoverGroup] = useState<"design" | "history" | null>(
    null
  );
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const refineDisabled = !refinePanel || !selectedNodeId;

  // Restore last-used composer tab.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(tabKey);
      if (raw === "prompt" || raw === "variations" || raw === "refine") {
        setActive(raw);
      }
    } catch {
      // ignore
    }
  }, [tabKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(tabKey, active);
    } catch {
      // ignore
    }
  }, [active, tabKey]);

  // When refine becomes disabled while active, retreat to prompt so the user
  // sees something meaningful.
  useEffect(() => {
    if (active === "refine" && refineDisabled) setActive("prompt");
  }, [active, refineDisabled]);

  // Keep legacy compose.toggle event working so existing keyboard shortcuts
  // can still jump to a specific composer tab.
  useEffect(() => {
    function onEvent(event: Event) {
      const detail = (event as CustomEvent<{ tab?: ComposeTabId }>).detail;
      if (
        detail?.tab === "prompt" ||
        detail?.tab === "variations" ||
        (detail?.tab === "refine" && !refineDisabled)
      ) {
        setActive(detail.tab);
      }
    }
    window.addEventListener("opendesign:compose.toggle", onEvent as EventListener);
    return () =>
      window.removeEventListener(
        "opendesign:compose.toggle",
        onEvent as EventListener
      );
  }, [refineDisabled]);

  // Close popover on Escape and outside click.
  useEffect(() => {
    if (!popoverGroup) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPopoverGroup(null);
    }
    function onDown(event: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) {
        setPopoverGroup(null);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [popoverGroup]);

  const TABS: ReadonlyArray<{ id: ComposeTabId; label: string; disabled?: boolean }> = [
    { id: "prompt", label: t("studio.compose.prompt") },
    { id: "variations", label: t("studio.compose.variations") },
    { id: "refine", label: t("studio.compose.refine"), disabled: refineDisabled }
  ];

  return (
    <>
    <button
      type="button"
      className="studio-chat-mobile-toggle"
      onClick={() => setMobileExpanded((v) => !v)}
      aria-label={t("studio.chat.mobile.toggle")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {t("studio.chat.mobile.toggle")}
    </button>
    <aside
      className={`studio-chat-column${mobileExpanded ? " expanded" : ""}`}
      aria-label={t("studio.chat.icon")}
      data-popover-open={popoverGroup ? "true" : "false"}
    >
      <header className="studio-chat-column-head">
        <h2 className="studio-rail-heading">{t("studio.chat.icon")}</h2>
      </header>

      <div className="studio-chat-column-body">{chatContent}</div>

      <div className="studio-chat-column-composer" role="region">
        <div
          className="studio-compose-segmented"
          role="tablist"
          aria-label={t("studio.compose.prompt")}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === active ? "true" : "false"}
              className={
                tab.id === active
                  ? "studio-compose-tab is-active"
                  : "studio-compose-tab"
              }
              disabled={tab.disabled}
              onClick={() => !tab.disabled && setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="studio-compose-body" role="tabpanel" data-tab-active={active}>
          <div className="studio-compose-panel" hidden={active !== "prompt"}>
            {promptPanel}
          </div>
          <div className="studio-compose-panel" hidden={active !== "variations"}>
            {variationsPanel}
          </div>
          <div className="studio-compose-panel" hidden={active !== "refine"}>
            {refinePanel}
          </div>
        </div>
      </div>

      <footer className="studio-chat-column-foot" ref={popoverRef}>
        <div className="studio-chat-column-foot-icons">
          <button
            type="button"
            className={
              popoverGroup === "design"
                ? "studio-chat-column-icon-btn is-active"
                : "studio-chat-column-icon-btn"
            }
            aria-label={t("studio.rail.library")}
            title={t("studio.rail.library")}
            aria-expanded={popoverGroup === "design" ? "true" : "false"}
            onClick={() =>
              setPopoverGroup((prev) => (prev === "design" ? null : "design"))
            }
          >
            <IconLayers />
          </button>
          <button
            type="button"
            className={
              popoverGroup === "history"
                ? "studio-chat-column-icon-btn is-active"
                : "studio-chat-column-icon-btn"
            }
            aria-label={t("studio.rail.review")}
            title={t("studio.rail.review")}
            aria-expanded={popoverGroup === "history" ? "true" : "false"}
            onClick={() =>
              setPopoverGroup((prev) => (prev === "history" ? null : "history"))
            }
          >
            <IconClock />
          </button>
        </div>
        {popoverGroup ? (
          <StudioResourcePopover
            group={popoverGroup}
            onClose={() => setPopoverGroup(null)}
            {...resourcePanels}
          />
        ) : null}
      </footer>
    </aside>
    </>
  );
}
