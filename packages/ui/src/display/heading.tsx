import * as React from "react";
import { Text, type TextProps } from "./text";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingVariant = "display" | "title-l" | "title-m" | "title-s";

export type HeadingProps = {
  level?: HeadingLevel;
  variant?: HeadingVariant;
  tone?: TextProps["tone"];
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, "className" | "children">;

const defaultVariantForLevel: Record<HeadingLevel, HeadingVariant> = {
  1: "display",
  2: "title-l",
  3: "title-m",
  4: "title-s",
  5: "title-s",
  6: "title-s"
};

/**
 * Heading — shortcut around Text for semantic h1..h6 elements.
 * Picks a sensible display/title variant per level.
 */
export function Heading({
  level = 2,
  variant,
  tone,
  className,
  children,
  ...rest
}: HeadingProps) {
  const as = (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
  const v = variant ?? defaultVariantForLevel[level];
  return (
    <Text
      as={as}
      variant={v}
      tone={tone}
      className={className}
      {...rest}
    >
      {children}
    </Text>
  );
}
