"use client";

import * as React from "react";

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export type RadioGroupProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> & {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
};

/**
 * RadioGroup — ARIA radiogroup container that distributes name/value/onChange
 * to child `<Radio>` items.
 */
export function RadioGroup({
  name,
  value,
  defaultValue,
  onValueChange,
  disabled,
  orientation = "vertical",
  className,
  style,
  children,
  ...rest
}: RadioGroupProps) {
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const ctx: RadioGroupContextValue = {
    name,
    value: current,
    onValueChange: (next) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    },
    disabled
  };
  return (
    <div
      role="radiogroup"
      aria-orientation={orientation}
      className={className}
      style={{
        display: "flex",
        flexDirection: orientation === "horizontal" ? "row" : "column",
        gap: orientation === "horizontal" ? 16 : 8,
        ...style
      }}
      {...rest}
    >
      <RadioGroupContext.Provider value={ctx}>
        {children}
      </RadioGroupContext.Provider>
    </div>
  );
}

export type RadioProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "name" | "onChange"
> & {
  value: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
};

/**
 * Radio — 16px circle, rust dot when checked. Must be used inside a
 * `<RadioGroup>` or supplied its own `name` prop.
 */
export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  function Radio(
    { value, label, description, className, disabled, ...rest },
    ref
  ) {
    const group = React.useContext(RadioGroupContext);
    const checked = group ? group.value === value : undefined;
    const isDisabled = disabled || group?.disabled;
    return (
      <label
        data-disabled={isDisabled ? "true" : "false"}
        className={`odp-check-root${className ? ` ${className}` : ""}`}
      >
        <input
          ref={ref}
          type="radio"
          className="odp-visually-hidden"
          name={group?.name}
          value={value}
          checked={checked}
          disabled={isDisabled}
          onChange={() => group?.onValueChange?.(value)}
          {...rest}
        />
        <span className="odp-radio-box" aria-hidden />
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
