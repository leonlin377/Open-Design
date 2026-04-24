import * as React from "react";

export type SkeletonProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  width?: number | string;
  height?: number | string;
  shape?: "rect" | "text" | "circle";
  lines?: number;
};

/**
 * Skeleton — pulsing loading placeholder. With `lines>1`, stacks multiple
 * text-shaped rows; the last one is shortened for realism.
 */
export function Skeleton({
  width,
  height,
  shape = "rect",
  lines,
  style,
  className,
  ...rest
}: SkeletonProps) {
  if (shape === "text" && lines && lines > 1) {
    return (
      <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            data-shape="text"
            className={`odp-skeleton${className ? ` ${className}` : ""}`}
            style={{
              width: i === lines - 1 ? "60%" : width ?? "100%",
              height: height ?? "0.9em",
              ...style
            }}
            {...rest}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-shape={shape}
      className={`odp-skeleton${className ? ` ${className}` : ""}`}
      style={{
        width: width ?? (shape === "circle" ? 32 : "100%"),
        height: height ?? (shape === "circle" ? 32 : shape === "text" ? "0.9em" : 16),
        ...style
      }}
      {...rest}
    />
  );
}
