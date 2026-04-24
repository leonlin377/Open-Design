import * as React from "react";

export type TextVariant =
  | "display"
  | "title-l"
  | "title-m"
  | "title-s"
  | "body-l"
  | "body"
  | "body-s"
  | "label"
  | "caption"
  | "mono-label"
  | "data";

export type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "accent"
  | "inverse";

type TextElement =
  | "p"
  | "span"
  | "div"
  | "strong"
  | "em"
  | "small"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "label";

export type TextProps<E extends TextElement = "p"> = {
  as?: E;
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

/**
 * Text — polymorphic typography primitive. Variants map to the type scale
 * in tokens.css. Tone controls colour. Uses `.odp-text` class + data attrs.
 */
export function Text<E extends TextElement = "p">({
  as,
  variant = "body",
  tone = "primary",
  className,
  children,
  ...rest
}: TextProps<E>) {
  const Component = (as ?? "p") as React.ElementType;
  return (
    <Component
      data-variant={variant}
      data-tone={tone}
      className={`odp-text${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
