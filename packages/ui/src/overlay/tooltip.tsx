import * as React from "react";

export type TooltipProps = {
  label: React.ReactNode;
  children: React.ReactElement;
  className?: string;
};

/**
 * Tooltip — CSS-only hover/focus tooltip. 500ms delay per spec. Wraps its
 * single child in a span so the tooltip can anchor off it.
 */
export function Tooltip({ label, children, className }: TooltipProps) {
  const id = React.useId();
  // Clone children so they get `aria-describedby` wiring.
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-describedby": id
      })
    : children;
  return (
    <span className={`odp-tooltip${className ? ` ${className}` : ""}`}>
      {child}
      <span role="tooltip" id={id} className="odp-tooltip-content">
        {label}
      </span>
    </span>
  );
}
