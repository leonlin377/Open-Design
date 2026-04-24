import * as React from "react";

export type KbdProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

/**
 * Kbd — inline keyboard shortcut pill. Mono font, sunken bg, hairline.
 */
export function Kbd({ className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={`odp-kbd${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </kbd>
  );
}
