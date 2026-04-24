import * as React from "react";

export type DividerProps = React.HTMLAttributes<HTMLElement> & {
  orientation?: "horizontal" | "vertical";
  label?: React.ReactNode;
};

/**
 * Divider — 1px hairline. If a `label` is provided the divider renders as
 * a horizontal flex row with the label centred between two hairlines.
 */
export function Divider({
  orientation = "horizontal",
  label,
  className,
  role,
  ...rest
}: DividerProps) {
  if (label && orientation === "horizontal") {
    return (
      <div
        role={role ?? "separator"}
        aria-orientation="horizontal"
        className={`odp-divider-label${className ? ` ${className}` : ""}`}
        {...rest}
      >
        <span>{label}</span>
      </div>
    );
  }
  return (
    <hr
      data-orient={orientation}
      role={role ?? "separator"}
      aria-orientation={orientation}
      className={`odp-divider${className ? ` ${className}` : ""}`}
      {...(rest as React.HTMLAttributes<HTMLHRElement>)}
    />
  );
}
