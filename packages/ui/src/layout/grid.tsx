import * as React from "react";

type SpaceToken = 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16;

export type GridProps = React.HTMLAttributes<HTMLDivElement> & {
  columns?: number | "auto-fill" | "auto-fit";
  minColumnWidth?: string;
  gap?: SpaceToken;
  rowGap?: SpaceToken;
  columnGap?: SpaceToken;
  as?: keyof React.JSX.IntrinsicElements;
};

/**
 * Grid — CSS grid wrapper. Either fix a column count or pass `columns=auto-fill`
 * with a `minColumnWidth` for responsive, content-aware layouts.
 */
export function Grid({
  columns = 1,
  minColumnWidth = "240px",
  gap = 4,
  rowGap,
  columnGap,
  as = "div",
  style,
  ...rest
}: GridProps) {
  const Component = as as React.ElementType;
  const template =
    typeof columns === "number"
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(${columns}, minmax(${minColumnWidth}, 1fr))`;

  return (
    <Component
      style={{
        display: "grid",
        gridTemplateColumns: template,
        gap: `var(--space-${gap})`,
        rowGap: rowGap !== undefined ? `var(--space-${rowGap})` : undefined,
        columnGap: columnGap !== undefined ? `var(--space-${columnGap})` : undefined,
        ...style
      }}
      {...rest}
    />
  );
}
