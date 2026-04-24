import * as React from "react";

export type SelectSize = "sm" | "md" | "lg";

export type SelectOption =
  | { value: string; label: string; disabled?: boolean }
  | { value: string; label: string; group?: string; disabled?: boolean };

export type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> & {
  size?: SelectSize;
  error?: boolean;
  options?: readonly SelectOption[];
  placeholder?: string;
};

/**
 * Select — native `<select>` wrapped with a chevron icon. We rely on the
 * native picker UI for full a11y; size + error states come via data attrs.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      size = "md",
      error,
      disabled,
      className,
      options,
      placeholder,
      children,
      ...rest
    },
    ref
  ) {
    return (
      <span
        data-size={size}
        data-error={error ? "true" : "false"}
        className={`odp-select-root${className ? ` ${className}` : ""}`}
      >
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          ) : null}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <span className="odp-select-chevron" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    );
  }
);
