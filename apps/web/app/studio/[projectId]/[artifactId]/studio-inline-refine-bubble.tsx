"use client";

/**
 * Inline refine bubble — WARM-SHELL-001 / STUDIO-SELECTION-001.
 *
 * Floats near a selected element's top-right corner. Small input + send
 * glyph; ↩ submits to the existing refine SSE stream. Dismiss on Escape or
 * outside click.
 *
 * Selection state now flows through `SelectionProvider`. The bubble reads
 * the currently-selected DOM rect (in parent-viewport coords) via
 * `useSelection().getViewportRect()` and positions itself just above the
 * element's right edge using `position: fixed`. It fails closed when no
 * element is selected.
 *
 * Composition: the floating shell is wrapped in `<Surface tone="raised">`
 * so it inherits `--paper-raised` + hairline + `--shadow-sm` from the
 * token system. The header uses `<Inline justify="space-between">`; the
 * close affordance is a ghost `<Button>`; the input is the `<Input>`
 * primitive; the submit control is a primary `<Button>`; and the
 * error/pending status lines delegate to `<Alert>` / `<Text>`.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Inline,
  Input,
  Surface,
  Text
} from "@opendesign/ui";
import {
  streamRefineNode,
  type ArtifactRefineStreamEvent
} from "../../../../lib/opendesign-generation-extras";
import { useSelection } from "./selection-context";

type StudioInlineRefineBubbleProps = {
  projectId: string;
  artifactId: string;
  nodeId: string;
  nodeName?: string;
  onClose: () => void;
};

export function StudioInlineRefineBubble({
  projectId,
  artifactId,
  nodeId,
  nodeName,
  onClose
}: StudioInlineRefineBubbleProps) {
  const router = useRouter();
  const { selected, getViewportRect } = useSelection();
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<
    { tone: "info" | "error" | "success"; message: string } | null
  >(null);
  const [pending, setPending] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Compute bubble anchor point from the selected element's viewport rect.
  // Placed just above the element's right edge; we measure the bubble after
  // mount so the top offset accounts for the real rendered height.
  useLayoutEffect(() => {
    const rect = getViewportRect();
    if (!rect) {
      setAnchor(null);
      return;
    }
    const BUBBLE_GAP = 8;
    const bubbleHeight = rootRef.current?.offsetHeight ?? 0;
    const bubbleWidth = rootRef.current?.offsetWidth ?? 320;
    // Anchor at top-right of the selected element (rect.right - bubbleWidth).
    setAnchor({
      top: Math.max(8, rect.top - bubbleHeight - BUBBLE_GAP),
      left: Math.max(8, rect.left + rect.width - bubbleWidth)
    });
  }, [getViewportRect, selected]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    function onDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  async function submit() {
    const trimmed = instruction.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setStatus({ tone: "info", message: "Starting refine…" });
    try {
      await streamRefineNode({
        projectId,
        artifactId,
        nodeId,
        instruction: trimmed,
        onEvent: (event: ArtifactRefineStreamEvent) => {
          if (
            event.type === "started" ||
            event.type === "planning" ||
            event.type === "applying"
          ) {
            setStatus({ tone: "info", message: event.message });
          } else if (event.type === "completed") {
            setStatus({ tone: "success", message: event.message });
            router.refresh();
            setTimeout(onClose, 600);
          } else if (event.type === "failed") {
            setStatus({ tone: "error", message: event.message });
          }
        }
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Refine stream failed."
      });
    } finally {
      setPending(false);
    }
  }

  if (!selected) {
    return null;
  }

  // `position: fixed` + explicit top/left lets us use viewport coordinates
  // directly (see `getViewportRect` math in selection-context). The CSS
  // default top/right are overridden via inline style.
  const style: React.CSSProperties | undefined = anchor
    ? {
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        right: "auto"
      }
    : undefined;

  return (
    <div
      ref={rootRef}
      className="studio-inline-refine-bubble"
      role="dialog"
      aria-label={`Refine ${nodeName ?? "element"}`}
      style={style}
    >
      <Surface
        tone="raised"
        padding="sm"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          border: 0,
          background: "transparent",
          boxShadow: "none",
          padding: 0,
          borderRadius: "inherit"
        }}
      >
      <Inline
        justify="space-between"
        align="center"
        className="studio-inline-refine-bubble-head"
      >
        <Inline align="center" gap={2}>
          <span className="studio-inline-refine-bubble-dot" aria-hidden />
          <Text
            as="span"
            variant="caption"
            tone="muted"
            className="studio-inline-refine-bubble-title"
          >
            {nodeName ?? "Selection"}
          </Text>
        </Inline>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close refine"
          style={{
            width: 22,
            height: 22,
            minHeight: 22,
            padding: 0,
            borderRadius: 6
          }}
        >
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
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Button>
      </Inline>
      <form
        className="studio-inline-refine-bubble-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: "flex" }}>
          <Input
            ref={inputRef}
            size="sm"
            type="text"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Tell the AI what to change"
            className="studio-inline-refine-bubble-input"
            disabled={pending}
          />
        </span>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          className="studio-inline-refine-bubble-send"
          disabled={pending || instruction.trim().length === 0}
          aria-label="Send refine"
          style={{
            width: 28,
            height: 28,
            minHeight: 28,
            padding: 0,
            borderRadius: 6
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </Button>
      </form>
      {status ? (
        status.tone === "error" ? (
          <Alert
            tone="danger"
            className={`studio-inline-refine-bubble-status tone-${status.tone}`}
          >
            {status.message}
          </Alert>
        ) : (
          <Text
            as="div"
            variant="body-s"
            tone="muted"
            role="status"
            className={`studio-inline-refine-bubble-status tone-${status.tone}`}
          >
            {status.message}
          </Text>
        )
      ) : null}
      </Surface>
    </div>
  );
}
