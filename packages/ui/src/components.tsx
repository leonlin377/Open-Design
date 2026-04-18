import * as React from "react";

type ButtonVariant = "primary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "outline",
  size = "md",
  style,
  type,
  ...props
}: ButtonProps) {
  const sizes: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: "0.85rem" },
    md: { padding: "10px 18px", fontSize: "0.95rem" },
    lg: { padding: "12px 22px", fontSize: "1.05rem" }
  };

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: "var(--accent)",
      color: "#0a0c10",
      borderColor: "rgba(214, 255, 95, 0.7)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text)",
      borderColor: "var(--stroke)"
    },
    outline: {
      background: "rgba(18, 21, 29, 0.6)",
      color: "var(--text)",
      borderColor: "var(--stroke)"
    }
  };

  return (
    <button
      type={type ?? "button"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        borderRadius: "999px",
        border: "1px solid var(--stroke)",
        fontWeight: 600,
        letterSpacing: "0.01em",
        cursor: "pointer",
        transition: "transform 120ms ease",
        ...sizes[size],
        ...variants[variant],
        ...style
      }}
      {...props}
    />
  );
}

type BadgeTone = "accent" | "muted" | "outline";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "accent", style, ...props }: BadgeProps) {
  const tones: Record<BadgeTone, React.CSSProperties> = {
    accent: {
      background: "rgba(214, 255, 95, 0.16)",
      color: "var(--accent)",
      borderColor: "rgba(214, 255, 95, 0.4)"
    },
    muted: {
      background: "rgba(96, 209, 255, 0.12)",
      color: "var(--accent-2)",
      borderColor: "rgba(96, 209, 255, 0.35)"
    },
    outline: {
      background: "transparent",
      color: "var(--muted)",
      borderColor: "var(--stroke)"
    }
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: "999px",
        border: "1px solid var(--stroke)",
        fontSize: "0.72rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        ...tones[tone],
        ...style
      }}
      {...props}
    />
  );
}

type SurfaceTone = "panel" | "ghost";
type SurfacePadding = "sm" | "md" | "lg";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  as?: "div" | "section" | "article" | "aside";
};

export function Surface({
  as = "div",
  tone = "panel",
  padding = "md",
  style,
  ...props
}: SurfaceProps) {
  const paddings: Record<SurfacePadding, React.CSSProperties> = {
    sm: { padding: "10px 12px" },
    md: { padding: "16px" },
    lg: { padding: "20px" }
  };

  const tones: Record<SurfaceTone, React.CSSProperties> = {
    panel: {
      background: "var(--bg-panel)",
      borderColor: "var(--stroke)"
    },
    ghost: {
      background: "transparent",
      borderColor: "var(--stroke)"
    }
  };

  const Component = as;

  return (
    <Component
      style={{
        border: "1px solid var(--stroke)",
        borderRadius: "var(--radius-lg)",
        ...tones[tone],
        ...paddings[padding],
        ...style
      }}
      {...props}
    />
  );
}
