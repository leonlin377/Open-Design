"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Surface } from "@opendesign/ui";
import type {
  ChatMessage,
  ChatSelectedNode,
  ChatThread
} from "@opendesign/contracts/src/chat";
import {
  fetchChatThread,
  sendChatMessage,
  type SendChatMessageOutcome
} from "../lib/opendesign-chat";

// -----------------------------------------------------------------------------
// StudioChatPanel — collapsible right-rail conversational sidecar.
//
// Parallels StudioGeneratePanel's streaming/cancel/retry UX but works on a
// persistent thread keyed to the current artifact. When `selectedNode` is
// provided, the composer switches into "Ask about selected element" mode
// and sends that pointer along with the prompt so the assistant can scope
// its reply.
// -----------------------------------------------------------------------------

type StudioChatPanelProps = {
  projectId: string;
  artifactId: string;
  artifactName: string;
  selectedNode?: ChatSelectedNode | null;
  /** Controls whether the rail opens as expanded. Defaults to true. */
  initiallyOpen?: boolean;
  apiOrigin?: string;
};

type FeedbackState =
  | { tone: "success" | "warning" | "error"; message: string }
  | null;

type RetryState =
  | { retryable: true; prompt: string; selectedNode: ChatSelectedNode | null }
  | null;

function messageKeyFor(message: ChatMessage, index: number): string {
  return `${message.id}-${index}`;
}

function roleLabel(role: ChatMessage["role"]): string {
  switch (role) {
    case "assistant":
      return "Assistant";
    case "user":
      return "You";
    case "system":
      return "Context";
  }
}

export function StudioChatPanel({
  projectId,
  artifactId,
  artifactName,
  selectedNode,
  initiallyOpen = true,
  apiOrigin
}: StudioChatPanelProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [retry, setRetry] = useState<RetryState>(null);
  const [scopeToSelection, setScopeToSelection] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const effectiveSelectedNode = useMemo<ChatSelectedNode | null>(
    () => (selectedNode && scopeToSelection ? selectedNode : null),
    [selectedNode, scopeToSelection]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await fetchChatThread({
          projectId,
          artifactId,
          signal: controller.signal,
          ...(apiOrigin ? { apiOrigin } : {})
        });
        if (!cancelled) {
          setThread(loaded);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Chat thread could not be loaded."
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiOrigin, artifactId, projectId]);

  const runSend = useCallback(
    async (promptToSend: string, nodeToSend: ChatSelectedNode | null) => {
      if (streaming || promptToSend.trim().length === 0) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setPartial("");
      setFeedback(null);
      setRetry(null);

      let outcome: SendChatMessageOutcome | null = null;
      try {
        outcome = await sendChatMessage({
          projectId,
          artifactId,
          prompt: promptToSend,
          selectedNode: nodeToSend,
          signal: controller.signal,
          ...(apiOrigin ? { apiOrigin } : {}),
          onEvent: (event) => {
            if (event.type === "started") {
              setThread((current) =>
                current
                  ? { ...current, messages: [...current.messages, event.userMessage] }
                  : current
              );
              setPrompt("");
            } else if (event.type === "delta") {
              setPartial((value) => value + event.content);
            }
          }
        });
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        if (controller.signal.aborted) {
          setFeedback({ tone: "warning", message: "Chat cancelled." });
          setRetry({
            retryable: true,
            prompt: promptToSend,
            selectedNode: nodeToSend
          });
        } else {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error ? error.message : "Chat request failed."
          });
          setRetry({
            retryable: true,
            prompt: promptToSend,
            selectedNode: nodeToSend
          });
        }
        return;
      } finally {
        if (mountedRef.current) {
          setStreaming(false);
          setPartial("");
        }
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }

      if (!mountedRef.current || !outcome) {
        return;
      }

      if (outcome.failure) {
        setFeedback({ tone: "error", message: outcome.failure.message });
        if (outcome.failure.retryable) {
          setRetry({
            retryable: true,
            prompt: promptToSend,
            selectedNode: nodeToSend
          });
        }
        return;
      }

      if (outcome.assistantMessage) {
        setThread((current) =>
          current
            ? {
                ...current,
                messages: [...current.messages, outcome!.assistantMessage!]
              }
            : current
        );
      }
    },
    [apiOrigin, artifactId, projectId, streaming]
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSend(prompt, effectiveSelectedNode);
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleRetry() {
    if (!retry) {
      return;
    }
    runSend(retry.prompt, retry.selectedNode);
  }

  const visibleMessages = useMemo(
    () => (thread?.messages ?? []).filter((message) => message.role !== "system"),
    [thread]
  );

  if (!open) {
    return (
      <aside className="studio-chat-panel collapsed">
        <Button
          variant="outline"
          type="button"
          onClick={() => setOpen(true)}
        >
          Open Chat
        </Button>
      </aside>
    );
  }

  return (
    <aside className="studio-chat-panel" aria-label="Studio chat sidecar">
      <Surface className="project-card" as="section">
        <div className="studio-chat-header">
          <div>
            <h3>Chat about {artifactName}</h3>
            <p className="footer-note">
              Ask the assistant about this artifact, request edits in natural
              language, or focus on the selected scene element.
            </p>
          </div>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Collapse
          </Button>
        </div>

        {selectedNode ? (
          <label className="studio-chat-scope">
            <input
              type="checkbox"
              checked={scopeToSelection}
              onChange={(event) => setScopeToSelection(event.target.checked)}
            />
            <span>
              Ask about selected element: <strong>{selectedNode.nodeName}</strong>{" "}
              ({selectedNode.nodeType})
            </span>
          </label>
        ) : null}

        <div className="studio-chat-messages" role="log" aria-live="polite">
          {thread == null ? (
            <div className="footer-note">Loading thread…</div>
          ) : visibleMessages.length === 0 && !streaming ? (
            <div className="footer-note">
              No messages yet. Ask the assistant about the current artifact.
            </div>
          ) : (
            visibleMessages.map((message, index) => (
              <div
                key={messageKeyFor(message, index)}
                className={`studio-chat-message ${message.role}`}
              >
                <div className="studio-chat-role">{roleLabel(message.role)}</div>
                <div className="studio-chat-content">{message.content}</div>
                {message.selectedNode ? (
                  <div className="footer-note">
                    on {message.selectedNode.nodeName} (
                    {message.selectedNode.nodeType})
                  </div>
                ) : null}
              </div>
            ))
          )}

          {streaming ? (
            <div className="studio-chat-message assistant streaming">
              <div className="studio-chat-role">Assistant</div>
              <div className="studio-chat-content">
                {partial.length > 0 ? partial : "Composing a reply…"}
              </div>
            </div>
          ) : null}
        </div>

        {feedback ? (
          <div className={`studio-feedback ${feedback.tone}`}>
            {feedback.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="stack-form">
          <label className="field">
            <span>
              {effectiveSelectedNode
                ? `Message (focused on ${effectiveSelectedNode.nodeName})`
                : "Message"}
            </span>
            <textarea
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                effectiveSelectedNode
                  ? "Ask about this element — e.g. 'Tighten the copy and suggest a stronger CTA.'"
                  : "Ask about this artifact — e.g. 'Summarize the scene and suggest edits.'"
              }
              disabled={streaming}
            />
          </label>
          <div className="studio-generate-actions">
            <Button
              variant="primary"
              type="submit"
              disabled={streaming || prompt.trim().length === 0}
            >
              {streaming ? "Streaming…" : "Send"}
            </Button>
            {streaming ? (
              <Button variant="outline" type="button" onClick={handleCancel}>
                Cancel
              </Button>
            ) : retry ? (
              <Button variant="outline" type="button" onClick={handleRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        </form>
      </Surface>
    </aside>
  );
}
