"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

export type CanvasNodeProps = {
  nodeId: string;
  label: string;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  role?: string;
  tone?: "default" | "subtle";
};

/**
 * Generic canvas node wrapper. Adds selection ring, hover outline, and
 * keyboard/mouse selection semantics. Inline editing is opt-in per node
 * subtype by using `<CanvasInlineEditable>` inside the body.
 */
export function CanvasNode({
  nodeId,
  label,
  selected,
  onSelect,
  children,
  className = "",
  style,
  role = "group",
  tone = "default"
}: CanvasNodeProps) {
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      // Don't steal focus from inline editors or nested controls.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.closest("[data-canvas-inline-edit]") ||
          target.closest("input, textarea, button, a, select, [contenteditable='true']"))
      ) {
        return;
      }
      event.stopPropagation();
      onSelect(nodeId);
    },
    [nodeId, onSelect]
  );

  const handleKey = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(nodeId);
      }
    },
    [nodeId, onSelect]
  );

  return (
    <div
      role={role}
      tabIndex={0}
      data-canvas-node-id={nodeId}
      data-canvas-node-selected={selected ? "true" : "false"}
      aria-label={label}
      aria-pressed={selected}
      onClick={handleClick}
      onKeyDown={handleKey}
      className={`canvas-node${selected ? " is-selected" : ""}${tone === "subtle" ? " is-subtle" : ""} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

export type CanvasInlineEditableProps = {
  value: string;
  placeholder?: string;
  multiline?: boolean;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div" | "strong";
  className?: string;
  ariaLabel?: string;
  onCommit: (next: string) => void;
};

/**
 * Double-click to turn a text node into a contentEditable inline editor.
 * Enter commits (Shift+Enter for newline in multiline mode), Escape cancels.
 * Calls `onCommit` with the committed value only when it differs from the
 * initial text.
 */
export function CanvasInlineEditable({
  value,
  placeholder,
  multiline = false,
  as = "p",
  className = "",
  ariaLabel,
  onCommit
}: CanvasInlineEditableProps) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const initialValueRef = useRef(value);

  useEffect(() => {
    initialValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (editing && elementRef.current) {
      const node = elementRef.current;
      node.textContent = initialValueRef.current;
      node.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [editing]);

  const beginEdit = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setEditing(true);
  }, []);

  const cancel = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.textContent = initialValueRef.current;
    }
    setEditing(false);
  }, []);

  const commit = useCallback(() => {
    const next = elementRef.current?.textContent ?? "";
    const trimmed = next.replace(/\u00a0/g, " ").trim();
    const original = (initialValueRef.current ?? "").trim();
    setEditing(false);
    if (trimmed === original) {
      return;
    }
    setPending(true);
    try {
      onCommit(trimmed);
    } finally {
      // Clear the pending flag on the next tick — if the action triggers a
      // server round trip the page will re-render with the new value anyway.
      setTimeout(() => setPending(false), 500);
    }
  }, [onCommit]);

  const handleKey = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if (event.key === "Enter" && (!multiline || !event.shiftKey)) {
        event.preventDefault();
        commit();
      }
    },
    [cancel, commit, multiline]
  );

  const Tag = as;
  const classes = `canvas-inline-edit${editing ? " is-editing" : ""}${pending ? " is-pending" : ""} ${className}`.trim();
  const resolved = value && value.length > 0 ? value : placeholder ?? "";

  if (!editing) {
    return (
      <Tag
        className={classes}
        data-canvas-inline-edit="true"
        aria-label={ariaLabel ?? "Double-click to edit"}
        title="Double-click to edit"
        onDoubleClick={beginEdit}
      >
        {resolved}
      </Tag>
    );
  }

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        elementRef.current = node;
      }}
      className={classes}
      data-canvas-inline-edit="true"
      role="textbox"
      aria-multiline={multiline}
      aria-label={ariaLabel ?? "Editing text"}
      contentEditable
      suppressContentEditableWarning
      onBlur={commit}
      onKeyDown={handleKey}
      onClick={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()}
    />
  );
}
