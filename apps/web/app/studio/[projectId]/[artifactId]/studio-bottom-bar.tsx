"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ChatSelectedNode } from "@opendesign/contracts/src/chat";
import type { ArtifactKind } from "@opendesign/contracts";
import { useT } from "../../../../lib/i18n";
import { StudioMessageBubble } from "../../../../components/studio-message-bubble";
import { getArtifactEditorAffordance } from "../../../../components/studio-artifact-affordances";
import { StudioResourcePopover } from "./studio-resource-popover";
import { UnifiedComposer } from "./unified-composer";
import { useStudioThread } from "./use-studio-thread";
import { useUnifiedSend, type UnifiedIntent } from "./use-unified-send";
import { useSelection } from "./selection-context";
import { AgentStatusStrip } from "./studio-agent-status";

function toChatSelectedNode(
  selected: { nodeId: string; elementTag: string; textPreview: string } | null
): ChatSelectedNode | null {
  if (!selected) return null;
  const nodeId = selected.nodeId.trim();
  const nodeType = selected.elementTag.trim() || "element";
  const nodeName =
    selected.textPreview.trim() || selected.elementTag.trim() || "Element";
  if (!nodeId) return null;
  return { nodeId, nodeName, nodeType };
}

type ResourceGroup = "design" | "history" | null;

type StudioBottomBarProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ArtifactKind;
  resourcePanels: {
    layersPanel: ReactNode;
    designSystemPanel: ReactNode;
    palettePanel: ReactNode;
    versionsPanel: ReactNode;
    exportPanel: ReactNode;
    commentsPanel: ReactNode;
  };
  apiOrigin?: string;
};

export function StudioBottomBar({
  projectId,
  artifactId,
  artifactKind,
  resourcePanels,
  apiOrigin,
}: StudioBottomBarProps) {
  const t = useT();
  const { selected } = useSelection();
  const chatSelectedNode = useMemo(() => toChatSelectedNode(selected), [selected]);
  const affordance = getArtifactEditorAffordance(artifactKind);

  const [expanded, setExpanded] = useState(false);
  const [resourceGroup, setResourceGroup] = useState<ResourceGroup>(null);
  const [previouslyActive] = useState(() => new Set<string>());

  const thread = useStudioThread({ projectId, artifactId, apiOrigin });
  const unified = useUnifiedSend({ projectId, artifactId, artifactKind, thread });

  const handleSend = (
    prompt: string,
    intent: UnifiedIntent,
    node: ChatSelectedNode | null
  ) => {
    unified.send(prompt, intent, node);
    if (!expanded) setExpanded(true);
  };

  const emptyState = thread.messages.length === 0 && unified.state === "idle";

  const toggleResource = (group: "design" | "history") => {
    setResourceGroup((prev) => (prev === group ? null : group));
  };

  return (
    <div
      className={`studio-bottom-bar${expanded ? " is-expanded" : ""}`}
      role="region"
      aria-label="Command bar"
    >
      {/* Expanded conversation area */}
      {expanded && (
        <div className="studio-bottom-bar-messages" role="log" aria-live="polite">
          {thread.loading ? (
            <div className="chat-skeleton">
              <div className="chat-skeleton-line" style={{ width: "60%" }} />
              <div className="chat-skeleton-line" style={{ width: "80%" }} />
            </div>
          ) : thread.error ? (
            <div className="studio-feedback error">{thread.error}</div>
          ) : emptyState ? (
            <div className="studio-conversation-empty">
              <p className="studio-conversation-empty-title">
                {t("studio.thread.empty")}
              </p>
              <div className="studio-conversation-suggestions">
                {affordance.starterPrompts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="studio-conversation-chip"
                    onClick={() => unified.send(q, "generate", chatSelectedNode)}
                  >
                    {q.length > 80 ? `${q.slice(0, 77)}...` : q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            thread.messages.map((msg) => (
              <StudioMessageBubble key={msg.id} message={msg} />
            ))
          )}

          {unified.state === "streaming" && unified.streamingContent ? (
            <div className="studio-msg studio-msg-assistant">
              <div className="studio-msg-content">{unified.streamingContent}</div>
            </div>
          ) : null}

          <div ref={thread.scrollAnchorRef} />
        </div>
      )}

      {/* Command strip */}
      <div className="studio-bottom-bar-strip">
        {/* Agent status chips */}
        <AgentStatusStrip
          sendState={unified.state}
          previouslyActive={previouslyActive}
        />

        {/* Divider */}
        <div className="studio-bottom-bar-divider" aria-hidden="true" />

        {/* Composer */}
        <div className="studio-bottom-bar-composer">
          <UnifiedComposer
            selectedNode={chatSelectedNode}
            sendState={unified.state}
            onSend={handleSend}
            onCancel={unified.cancel}
          />
        </div>

        {/* Right actions: expand toggle + resource triggers */}
        <div className="studio-bottom-bar-actions">
          <button
            type="button"
            className={`studio-bottom-bar-icon-btn${expanded ? " is-active" : ""}`}
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse conversation" : "Expand conversation"}
            aria-expanded={expanded}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {expanded
                ? <path d="M6 15l6-6 6 6" />
                : <path d="M6 9l6 6 6-6" />}
            </svg>
          </button>

          <button
            type="button"
            className={`studio-bottom-bar-icon-btn${resourceGroup === "design" ? " is-active" : ""}`}
            onClick={() => toggleResource("design")}
            aria-label="Design resources"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>

          <button
            type="button"
            className={`studio-bottom-bar-icon-btn${resourceGroup === "history" ? " is-active" : ""}`}
            onClick={() => toggleResource("history")}
            aria-label="History & export"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Resource popover — floats upward from bottom bar */}
      {resourceGroup && (
        <div className="studio-bottom-bar-resource-anchor">
          <StudioResourcePopover
            group={resourceGroup}
            onClose={() => setResourceGroup(null)}
            {...resourcePanels}
          />
        </div>
      )}
    </div>
  );
}
