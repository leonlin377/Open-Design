import * as React from "react";

type SpaceToken = 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16;
type Align = "stretch" | "start" | "center" | "end" | "baseline";
type Justify =
  | "start"
  | "center"
  | "end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type StackProps = React.HTMLAttributes<HTMLDivElement> & {
  gap?: SpaceToken;
  align?: Align;
  justify?: Justify;
  as?: keyof React.JSX.IntrinsicElements;
  wrap?: boolean;
};

const alignMap: Record<Align, React.CSSProperties["alignItems"]> = {
  stretch: "stretch",
  start: "flex-start",
  center: "center",
  end: "flex-end",
  baseline: "baseline"
};
const justifyMap: Record<Justify, React.CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
  "space-around": "space-around",
  "space-evenly": "space-evenly"
};

/**
 * Stack — vertical flex. `gap` maps to `--space-N` tokens (4px base).
 */
export function Stack({
  gap = 4,
  align = "stretch",
  justify = "start",
  as = "div",
  wrap,
  style,
  ...rest
}: StackProps) {
  const Component = as as React.ElementType;
  return (
    <Component
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `var(--space-${gap})`,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        flexWrap: wrap ? "wrap" : undefined,
        ...style
      }}
      {...rest}
    />
  );
}
