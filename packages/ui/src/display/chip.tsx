import * as React from "react";

export type ChipTone = "muted" | "accent" | "outline";

export type ChipProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "onRemove"> & {
  tone?: ChipTone;
  onRemove?: () => void;
  removeLabel?: string;
};

/**
 * Chip / Tag — pill radius, optional removable variant. When onRemove is
 * supplied, a close button is rendered with the given aria-label.
 */
export function Chip({
  tone = "muted",
  onRemove,
  removeLabel = "Remove",
  className,
  children,
  ...rest
}: ChipProps) {
  return (
    <span
      data-tone={tone}
      className={`odp-chip${className ? ` ${className}` : ""}`}
      {...rest}
    >
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="odp-chip-remove"
          aria-label={removeLabel}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
