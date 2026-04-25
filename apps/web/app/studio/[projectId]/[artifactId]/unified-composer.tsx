"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatSelectedNode } from "@opendesign/contracts/src/chat";
import { useT } from "../../../../lib/i18n";
import {
  detectIntent,
  type UnifiedIntent,
  type UnifiedSendState
} from "./use-unified-send";

type UnifiedComposerProps = {
  selectedNode: ChatSelectedNode | null;
  sendState: UnifiedSendState;
  onSend: (
    prompt: string,
    intent: UnifiedIntent,
    node: ChatSelectedNode | null
  ) => void;
  onCancel: () => void;
};

export function UnifiedComposer({
  selectedNode,
  sendState,
  onSend,
  onCancel
}: UnifiedComposerProps) {
  const t = useT();
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = sendState !== "idle";

  const intent: UnifiedIntent = selectedNode
    ? "refine"
    : detectIntent(prompt, false);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (busy || prompt.trim().length === 0) return;
      onSend(prompt, intent, selectedNode);
      setPrompt("");
    },
    [busy, prompt, intent, selectedNode, onSend]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape" && !busy) {
        setPrompt("");
      }
    },
    [handleSubmit, busy]
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [prompt]);

  const placeholder = selectedNode
    ? t("studio.unified.placeholder.refine")
    : t("studio.unified.placeholder");

  const modeLabel = selectedNode
    ? t("studio.unified.refining", { name: selectedNode.nodeName })
    : intent === "generate"
      ? t("studio.unified.mode.generate")
      : t("studio.unified.mode.chat");

  return (
    <form
      className="studio-unified-composer"
      onSubmit={handleSubmit}
    >
      {selectedNode ? (
        <div className="studio-unified-context-bar">
          <span className="studio-unified-context-label">{modeLabel}</span>
        </div>
      ) : null}
      <div className="studio-unified-input-row">
        <textarea
          ref={textareaRef}
          className="studio-unified-textarea"
          rows={1}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={busy}
        />
        {busy ? (
          <button
            type="button"
            className="studio-unified-send-btn"
            onClick={onCancel}
            aria-label={t("studio.chat.cancel")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            className="studio-unified-send-btn"
            disabled={prompt.trim().length === 0}
            aria-label={t("studio.unified.send")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
