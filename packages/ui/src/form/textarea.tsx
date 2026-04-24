"use client";

import * as React from "react";

export type TextareaSize = "sm" | "md" | "lg";

export type TextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "size"
> & {
  size?: TextareaSize;
  error?: boolean;
  autoGrow?: boolean;
};

/**
 * Textarea — multi-line input with optional auto-grow. Auto-grow resets the
 * height to auto then sets it to scrollHeight so it matches content.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      size = "md",
      error,
      autoGrow,
      disabled,
      className,
      onChange,
      rows,
      style,
      ...rest
    },
    ref
  ) {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle<
      HTMLTextAreaElement | null,
      HTMLTextAreaElement | null
    >(ref, () => innerRef.current);

    const grow = React.useCallback(() => {
      if (!autoGrow) return;
      const node = innerRef.current;
      if (!node) return;
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    }, [autoGrow]);

    React.useEffect(() => {
      grow();
    }, [grow]);

    return (
      <span
        data-size={size}
        data-error={error ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        data-autogrow={autoGrow ? "true" : "false"}
        className={`odp-input-root odp-textarea-root${className ? ` ${className}` : ""}`}
      >
        <textarea
          ref={innerRef}
          disabled={disabled}
          rows={rows ?? 3}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onChange?.(event);
            grow();
          }}
          style={style}
          {...rest}
        />
      </span>
    );
  }
);
