"use client";

import * as React from "react";

export type InputSize = "sm" | "md" | "lg";

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  size?: InputSize;
  error?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
};

/**
 * Input — single-line text input with optional leading/trailing slots and
 * clearable affordance. Sizes sm/md/lg. Focus ring from `.odp-input-root`.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      size = "md",
      error,
      disabled,
      leading,
      trailing,
      clearable,
      onClear,
      className,
      value,
      defaultValue,
      onChange,
      ...rest
    },
    ref
  ) {
    const [internal, setInternal] = React.useState<string>(
      typeof defaultValue === "string" ? defaultValue : ""
    );
    const isControlled = value !== undefined;
    const current = isControlled ? String(value ?? "") : internal;
    const showClear = clearable && current.length > 0 && !disabled;

    const innerRef = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
      ref,
      () => innerRef.current
    );

    return (
      <span
        data-size={size}
        data-error={error ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        className={`odp-input-root${className ? ` ${className}` : ""}`}
      >
        {leading ? <span className="odp-input-slot" aria-hidden>{leading}</span> : null}
        <input
          ref={innerRef}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          value={isControlled ? current : undefined}
          defaultValue={!isControlled ? defaultValue : undefined}
          onChange={(event) => {
            if (!isControlled) setInternal(event.target.value);
            onChange?.(event);
          }}
          {...rest}
        />
        {showClear ? (
          <button
            type="button"
            className="odp-input-clear"
            aria-label="Clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!isControlled) setInternal("");
              if (onClear) {
                onClear();
              } else if (innerRef.current) {
                const node = innerRef.current;
                const setter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype,
                  "value"
                )?.set;
                setter?.call(node, "");
                node.dispatchEvent(new Event("input", { bubbles: true }));
              }
              innerRef.current?.focus();
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
        {trailing ? <span className="odp-input-slot" aria-hidden>{trailing}</span> : null}
      </span>
    );
  }
);
