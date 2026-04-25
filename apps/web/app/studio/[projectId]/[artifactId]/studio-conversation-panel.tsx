"use client";

import { useMemo } from "react";
import type { ChatSelectedNode } from "@opendesign/contracts/src/chat";
import type { ArtifactKind } from "@opendesign/contracts";
import { useT } from "../../../../lib/i18n";
import { StudioMessageBubble } from "../../../../components/studio-message-bubble";
import { getArtifactEditorAffordance } from "../../../../components/studio-artifact-affordances";
import { UnifiedComposer } from "./unified-composer";
import { useStudioThread } from "./use-studio-thread";
import {
  useUnifiedSend,
  type UnifiedIntent
} from "./use-unified-send";
import { useSelection } from "./selection-context";

type StudioConversationPanelProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ArtifactKind;
  apiOrigin?: string;
};

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

export function StudioConversationPanel({
  projectId,
  artifactId,
  artifactKind,
  apiOrigin
}: StudioConversationPanelProps) {
  const t = useT();
  const { selected } = useSelection();
  const chatSelectedNode = useMemo(() => toChatSelectedNode(selected), [selected]);
  const affordance = getArtifactEditorAffordance(artifactKind);

  const thread = useStudioThread({
    projectId,
    artifactId,
    apiOrigin
  });

  const unified = useUnifiedSend({
    projectId,
    artifactId,
    artifactKind,
    thread
  });

  const handleSend = (
    prompt: string,
    intent: UnifiedIntent,
    node: ChatSelectedNode | null
  ) => {
    unified.send(prompt, intent, node);
  };

  const emptyState = thread.messages.length === 0 && unified.state === "idle";

  return (
    <div className="studio-conversation-panel">
      <div className="studio-conversation-messages" role="log" aria-live="polite">
        {thread.loading ? (
          <div className="chat-skeleton">
            <div className="chat-skeleton-line" style={{ width: "60%" }} />
            <div className="chat-skeleton-line" style={{ width: "80%" }} />
            <div className="chat-skeleton-line" style={{ width: "40%" }} />
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
                  onClick={() =>
                    unified.send(q, "generate", chatSelectedNode)
                  }
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
            <div className="studio-msg-content">
              {unified.streamingContent}
            </div>
          </div>
        ) : null}

        <div ref={thread.scrollAnchorRef} />
      </div>

      <UnifiedComposer
        selectedNode={chatSelectedNode}
        sendState={unified.state}
        onSend={handleSend}
        onCancel={unified.cancel}
      />
    </div>
  );
}
