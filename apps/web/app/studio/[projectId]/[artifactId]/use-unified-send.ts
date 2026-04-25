"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatSelectedNode } from "@opendesign/contracts/src/chat";
import type { ArtifactKind } from "@opendesign/contracts";
import { sendChatMessage } from "../../../../lib/opendesign-chat";
import { buildApiRequestError } from "../../../../lib/api-errors";
import {
  consumeGenerationStream,
  type GenerateStreamOutcome
} from "../../../../lib/opendesign-generate";
import { streamRefineNode } from "../../../../lib/opendesign-generation-extras";
import { getArtifactEditorAffordance } from "../../../../components/studio-artifact-affordances";
import type { useStudioThread } from "./use-studio-thread";

export type UnifiedIntent = "chat" | "generate" | "refine";
export type UnifiedSendState = "idle" | "streaming" | "generating" | "refining";

const GENERATE_KEYWORDS =
  /^(创建|添加|设计|生成|做一个|build|create|add|design|generate|make)\b/i;

export function detectIntent(
  prompt: string,
  hasSelection: boolean
): UnifiedIntent {
  if (hasSelection) return "refine";
  if (GENERATE_KEYWORDS.test(prompt.trim())) return "generate";
  return "chat";
}

function resolveApiOrigin(): string {
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

export function useUnifiedSend(input: {
  projectId: string;
  artifactId: string;
  artifactKind: ArtifactKind;
  thread: ReturnType<typeof useStudioThread>;
}) {
  const { projectId, artifactId, artifactKind, thread } = input;
  const router = useRouter();
  const [state, setState] = useState<UnifiedSendState>("idle");
  const [streamingContent, setStreamingContent] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const apiOrigin = resolveApiOrigin();
  const affordance = getArtifactEditorAffordance(artifactKind);

  const send = useCallback(
    async (
      prompt: string,
      intent: UnifiedIntent,
      selectedNode: ChatSelectedNode | null
    ) => {
      if (state !== "idle") return;

      const controller = new AbortController();
      abortRef.current = controller;
      setStreamingContent("");
      setProgressMessage("");

      thread.addMessage("user", prompt);

      try {
        if (intent === "chat") {
          setState("streaming");
          const outcome = await sendChatMessage({
            projectId,
            artifactId,
            prompt,
            selectedNode,
            signal: controller.signal,
            apiOrigin,
            onEvent: (event) => {
              if (event.type === "delta") {
                setStreamingContent((v) => v + event.content);
              }
            }
          });
          if (outcome.failure) {
            thread.addMessage("assistant", outcome.failure.message, {
              tone: "error"
            });
          } else if (outcome.assistantMessage) {
            thread.addChatMessage(outcome.assistantMessage);
          }
        } else if (intent === "generate") {
          setState("generating");
          const progressId = thread.addMessage("progress", "Connecting...");

          const response = await fetch(
            `${apiOrigin}/api/projects/${projectId}/artifacts/${artifactId}/generate`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                accept: "text/event-stream",
                "content-type": "application/json"
              },
              body: JSON.stringify({ prompt }),
              signal: controller.signal
            }
          );

          if (!response.ok) {
            throw await buildApiRequestError(
              response,
              "Artifact generation failed."
            );
          }

          const outcome: GenerateStreamOutcome =
            await consumeGenerationStream(
              response,
              (message) => {
                setProgressMessage(message);
                thread.updateProgress(progressId, message);
              },
              controller.signal
            );

          thread.removeMessage(progressId);

          if (outcome.kind === "failed") {
            thread.addMessage("assistant", outcome.message, { tone: "error" });
          } else {
            const count =
              outcome.payload.generation.scenePatch.appendedNodes.length;
            const unit =
              count === 1
                ? affordance.unitLabel
                : `${affordance.unitLabel}s`;
            thread.addMessage(
              "generate-result",
              `Generated ${count} ${unit}`,
              {
                nodeCount: count,
                tone: outcome.payload.generation.diagnostics.warning
                  ? "warning"
                  : "success"
              }
            );
            router.refresh();
          }
        } else if (intent === "refine" && selectedNode) {
          setState("refining");
          const progressId = thread.addMessage(
            "progress",
            `Refining ${selectedNode.nodeName}...`
          );

          await streamRefineNode({
            projectId,
            artifactId,
            nodeId: selectedNode.nodeId,
            instruction: prompt,
            signal: controller.signal,
            onEvent: (event) => {
              if (
                event.type === "planning" ||
                event.type === "applying" ||
                event.type === "started"
              ) {
                setProgressMessage(event.message);
                thread.updateProgress(progressId, event.message);
              }
              if (event.type === "completed") {
                thread.removeMessage(progressId);
                thread.addMessage(
                  "refine-result",
                  `Refined: ${selectedNode.nodeName}`,
                  {
                    nodeName: selectedNode.nodeName,
                    tone: "success"
                  }
                );
                router.refresh();
              }
              if (event.type === "failed") {
                thread.removeMessage(progressId);
                thread.addMessage("assistant", event.message, {
                  tone: "error"
                });
              }
            }
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          thread.addMessage("assistant", "Cancelled.", { tone: "warning" });
        } else {
          thread.addMessage(
            "assistant",
            error instanceof Error ? error.message : "Request failed.",
            { tone: "error" }
          );
        }
      } finally {
        setState("idle");
        setStreamingContent("");
        setProgressMessage("");
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      state,
      projectId,
      artifactId,
      apiOrigin,
      affordance.unitLabel,
      router,
      thread
    ]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    send,
    cancel,
    state,
    streamingContent,
    progressMessage
  };
}
