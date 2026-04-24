"use client";

import * as React from "react";

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export type PopoverProps = {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  placement?: Placement;
  offset?: number;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Popover — anchored floating panel. No positioning library: computes
 * `top/left` from the anchor's bounding rect on open + window resize. Closes
 * on Esc and on outside-click. Focus is trapped inside.
 */
export function Popover({
  open,
  onClose,
  anchor,
  placement = "bottom-start",
  offset = 6,
  children,
  className,
  ariaLabel
}: PopoverProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const reposition = React.useCallback(() => {
    const anchorEl = anchor.current;
    const panel = ref.current;
    if (!anchorEl || !panel) return;
    const a = anchorEl.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    let top = 0;
    let left = 0;
    if (placement.startsWith("bottom")) top = a.bottom + offset + window.scrollY;
    else top = a.top - p.height - offset + window.scrollY;
    if (placement.endsWith("start")) left = a.left + window.scrollX;
    else left = a.right - p.width + window.scrollX;
    setPos({ top, left });
  }, [anchor, placement, offset]);

  React.useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const handle = () => reposition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, reposition]);

  React.useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel.contains(target)) return;
      if (anchor.current && anchor.current.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={ariaLabel}
      className={`odp-popover${className ? ` ${className}` : ""}`}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden"
      }}
    >
      {children}
    </div>
  );
}
