"use client";

import * as React from "react";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  ariaLabel?: string;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog (Modal) — uses the native `<dialog>` element with
 * `showModal()` for scrim + inertness, plus a manual focus trap for
 * Tab/Shift+Tab loop. Esc and backdrop click close by default.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel,
  className
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open) {
      if (!node.open) {
        try {
          node.showModal();
        } catch {
          node.setAttribute("open", "");
        }
      }
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    } else if (node.open) {
      node.close();
    }
  }, [open]);

  const handleCancel: React.ReactEventHandler<HTMLDialogElement> = (event) => {
    event.preventDefault();
    if (closeOnEscape) onClose();
  };

  const handleClick: React.MouseEventHandler<HTMLDialogElement> = (event) => {
    if (!closeOnBackdrop) return;
    if (event.target === ref.current) onClose();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDialogElement> = (event) => {
    if (event.key !== "Tab") return;
    const node = ref.current;
    if (!node) return;
    const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute("data-focus-trap-skip")
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      className={`odp-dialog${className ? ` ${className}` : ""}`}
      aria-label={title === undefined ? ariaLabel : undefined}
      aria-labelledby={title !== undefined ? titleId : undefined}
      aria-describedby={description !== undefined ? descId : undefined}
      onCancel={handleCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="odp-dialog-panel" onClick={(event) => event.stopPropagation()}>
        {(title !== undefined || description !== undefined) && (
          <div className="odp-dialog-header">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {title !== undefined ? (
                <h2 id={titleId} className="odp-dialog-title">
                  {title}
                </h2>
              ) : null}
              {description !== undefined ? (
                <p id={descId} className="odp-dialog-desc">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="odp-alert-dismiss"
              onClick={onClose}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div>{children}</div>
        {footer !== undefined ? (
          <div className="odp-dialog-footer">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
}
