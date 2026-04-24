import * as React from "react";

export type SwitchProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "onChange"
> & {
  label?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * Switch — 32x18 toggle with rust-on background. Backed by a real
 * `<input type=checkbox>` for screen-reader a11y.
 */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  function Switch(
    { label, className, disabled, onCheckedChange, ...rest },
    ref
  ) {
    return (
      <label
        data-disabled={disabled ? "true" : "false"}
        className={`odp-switch${className ? ` ${className}` : ""}`}
      >
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className="odp-visually-hidden"
          disabled={disabled}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          {...rest}
        />
        <span className="odp-switch-track" aria-hidden>
          <span className="odp-switch-thumb" />
        </span>
        {label !== undefined ? <span>{label}</span> : null}
      </label>
    );
  }
);
