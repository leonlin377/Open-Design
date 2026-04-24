import * as React from "react";

type ContainerWidth = "sm" | "md" | "lg" | "xl" | "full";

const widthMap: Record<ContainerWidth, string> = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  full: "100%"
};

export type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: ContainerWidth;
  padded?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
};

/**
 * Container — centered max-width wrapper. Respects breakpoint tokens via a
 * static map. Set `padded` to apply horizontal spacing from token scale.
 */
export function Container({
  width = "lg",
  padded = true,
  as = "div",
  style,
  ...rest
}: ContainerProps) {
  const Component = as as React.ElementType;
  return (
    <Component
      style={{
        maxWidth: widthMap[width],
        marginInline: "auto",
        width: "100%",
        paddingInline: padded ? "var(--space-6)" : undefined,
        ...style
      }}
      {...rest}
    />
  );
}
