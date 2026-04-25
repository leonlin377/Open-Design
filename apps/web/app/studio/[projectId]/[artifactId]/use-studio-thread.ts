"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatThread } from "@opendesign/contracts/src/chat";
import { fetchChatThread } from "../../../../lib/opendesign-chat";

export type StudioThreadMessageKind =
  | "user"
  | "assistant"
  | "generate-result"
  | "refine-result"
  | "progress";

export type StudioThreadMessage = {
  id: string;
  kind: StudioThreadMessageKind;
  content: string;
  timestamp: number;
  meta?: {
    nodeCount?: number;
    nodeName?: string;
    tone?: "success" | "warning" | "error";
  };
};

let nextId = 1;
function makeId(): string {
  return `thread-${Date.now()}-${nextId++}`;
}

function chatMessageToThread(msg: ChatMessage): StudioThreadMessage {
  return {
    id: msg.id,
    kind: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
    timestamp: Date.now()
  };
}

export function useStudioThread(input: {
  projectId: string;
  artifactId: string;
  apiOrigin?: string;
}) {
  const { projectId, artifactId, apiOrigin } = input;
  const [messages, setMessages] = useState<StudioThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const thread = await fetchChatThread({
          projectId,
          artifactId,
          signal: controller.signal,
          ...(apiOrigin ? { apiOrigin } : {})
        });
        if (!cancelled) {
          const loaded = thread.messages
            .filter((m) => m.role !== "system")
            .map(chatMessageToThread);
          setMessages(loaded);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load chat history."
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, artifactId, apiOrigin]);

  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastCountRef.current = messages.length;
  }, [messages.length]);

  const addMessage = useCallback(
    (
      kind: StudioThreadMessageKind,
      content: string,
      meta?: StudioThreadMessage["meta"]
    ) => {
      const msg: StudioThreadMessage = {
        id: makeId(),
        kind,
        content,
        timestamp: Date.now(),
        meta
      };
      setMessages((prev) => [...prev, msg]);
      return msg.id;
    },
    []
  );

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, chatMessageToThread(msg)]);
  }, []);

  const updateProgress = useCallback(
    (id: string, content: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content } : m))
      );
    },
    []
  );

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return {
    messages,
    loading,
    error,
    scrollAnchorRef,
    addMessage,
    addChatMessage,
    updateProgress,
    removeMessage
  };
}
