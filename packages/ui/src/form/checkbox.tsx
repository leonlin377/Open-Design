"use client";

import * as React from "react";

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> & {
  label?: React.ReactNode;
  indeterminate?: boolean;
  description?: React.ReactNode;
};

/**
 * Checkbox — custom-rendered 16px box with checkmark / indeterminate dash.
 * Wraps a real `<input type=checkbox>` inside a label for native a11y.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { label, indeterminate, description, className, disabled, ...rest },
    ref
  ) {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
      ref,
      () => innerRef.current
    );
    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    return (
      <label
        data-disabled={disabled ? "true" : "false"}
        data-indeterminate={indeterminate ? "true" : "false"}
        className={`odp-check-root${className ? ` ${className}` : ""}`}
      >
        <input
          ref={innerRef}
          type="checkbox"
          className="odp-visually-hidden"
          disabled={disabled}
          aria-checked={indeterminate ? "mixed" : undefined}
          {...rest}
        />
        <span className="odp-check-box" aria-hidden>
          <svg className="odp-check-mark" width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <svg className="odp-check-indet" width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 6H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        {label !== undefined || description !== undefined ? (
          <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
            {label !== undefined ? <span>{label}</span> : null}
            {description !== undefined ? (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>
                {description}
              </span>
            ) : null}
          </span>
        ) : null}
      </label>
    );
  }
);
