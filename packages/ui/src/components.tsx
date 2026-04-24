import * as React from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/**
 * Button — Claude Design flat (CLAUDE-LOCK-001).
 *
 *  - Flat. No gradient, no gloss, no shadow, no transform, no filter.
 *  - Min heights: sm 32 / md 40 / lg 44.
 *  - Padding: sm 8/14, md 10/16, lg 12/20.
 *  - Font sizes: sm 14 / md 15 / lg 16.
 *  - Radius: var(--radius-lg) (12px).
 *  - Font weight 500.
 *  - Hover / active handled by `.od-button[data-variant=...]` rules in
 *    globals.css. Active is opacity: 0.9, no translateY, no filter.
 *  - Focus: handled by the global `:focus-visible` rule (rust ring).
 */
export function Button({
  variant = "secondary",
  size = "md",
  style,
  type,
  ...props
}: ButtonProps) {
  const sizes: Record<ButtonSize, React.CSSProperties> = {
    sm: {
      padding: "8px 14px",
      fontSize: "0.875rem", // 14px
      minHeight: 32
    },
    md: {
      padding: "10px 16px",
      fontSize: "0.9375rem", // 15px
      minHeight: 40
    },
    lg: {
      padding: "12px 20px",
      fontSize: "1rem", // 16px
      minHeight: 44
    }
  };

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: "var(--rust)",
      color: "var(--rust-contrast)",
      borderColor: "transparent"
    },
    secondary: {
      background: "var(--paper-sunk)",
      color: "var(--ink-1)",
      borderColor: "var(--hairline)"
    },
    outline: {
      background: "transparent",
      color: "var(--ink-1)",
      borderColor: "var(--hairline)"
    },
    ghost: {
      background: "transparent",
      color: "var(--ink-2)",
      borderColor: "transparent"
    },
    danger: {
      background: "#C84734",
      color: "#FFFFFF",
      borderColor: "transparent"
    }
  };

  return (
    <button
      type={type ?? "button"}
      data-variant={variant}
      data-size={size}
      className={`od-button ${props.className ?? ""}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid transparent",
        fontWeight: 500,
        letterSpacing: "var(--tracking-body, 0)",
        fontFamily: "inherit",
        cursor: "pointer",
        transition:
          "background-color 140ms cubic-bezier(0.2,0,0,1), color 140ms cubic-bezier(0.2,0,0,1), border-color 140ms ease",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...sizes[size],
        ...variants[variant],
        ...style
      }}
      {...props}
    />
  );
}

type BadgeTone = "accent" | "muted" | "outline" | "success" | "warning";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

/**
 * Badge — Claude Design (CLAUDE-LOCK-001).
 *  - Height 22, radius 10px, padding 2/8.
 *  - 13px, weight 500, no uppercase, no border by default.
 *  - Tones:
 *      default / muted -> paper-sunk / ink-2
 *      accent / success -> rust-soft / rust
 *      warning         -> #F9E4B7 / #7A5A12
 *      (danger handled ad-hoc by callers if needed: #F4CFCC / #98291B)
 */
export function Badge({ tone = "accent", style, ...props }: BadgeProps) {
  const tones: Record<BadgeTone, React.CSSProperties> = {
    accent: {
      background: "var(--rust-soft)",
      color: "var(--rust)",
      borderColor: "transparent"
    },
    muted: {
      background: "var(--paper-sunk)",
      color: "var(--ink-2)",
      borderColor: "transparent"
    },
    outline: {
      background: "transparent",
      color: "var(--ink-2)",
      borderColor: "var(--hairline)"
    },
    success: {
      background: "var(--rust-soft)",
      color: "var(--rust)",
      borderColor: "transparent"
    },
    warning: {
      background: "#F9E4B7",
      color: "#7A5A12",
      borderColor: "transparent"
    }
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        height: 22,
        borderRadius: 10,
        border: "1px solid transparent",
        fontSize: "0.8125rem", // 13px
        letterSpacing: 0,
        textTransform: "none",
        fontWeight: 500,
        lineHeight: 1,
        ...tones[tone],
        ...style
      }}
      {...props}
    />
  );
}

type SurfaceTone = "panel" | "ghost" | "muted" | "raised" | "glass";
type SurfacePadding = "sm" | "md" | "lg";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  /**
   * The rendered element. We intentionally accept a broader set than the
   * minimum container vocabulary so canvas-layer consumers can project
   * headings / paragraphs / inline text through the same surface styles
   * without a parallel component.
   */
  as?:
    | "div"
    | "section"
    | "article"
    | "aside"
    | "header"
    | "footer"
    | "nav"
    | "main"
    | "span"
    | "p"
    | "strong"
    | "em"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";
};

/**
 * Surface (CLAUDE-LOCK-001) —
 *  - panel:   paper bg + optional 1px hairline, no shadow.
 *  - raised:  paper-raised bg + shadow-sm.
 *  - muted / sunken: paper-sunk bg + subtle hairline, no shadow.
 *  - ghost:   transparent + hairline.
 *  - glass:   alias -> raised.
 *  - Default radius `var(--radius-lg)` (12px).
 */
export function Surface({
  as = "div",
  tone = "panel",
  padding = "md",
  style,
  ...props
}: SurfaceProps) {
  const paddings: Record<SurfacePadding, React.CSSProperties> = {
    sm: { padding: "12px 14px" },
    md: { padding: "16px" },
    lg: { padding: "24px" }
  };

  const tones: Record<SurfaceTone, React.CSSProperties> = {
    panel: {
      background: "var(--paper)",
      borderColor: "var(--hairline)",
      boxShadow: "none"
    },
    raised: {
      background: "var(--paper-raised)",
      borderColor: "var(--hairline)",
      boxShadow: "var(--shadow-sm)"
    },
    muted: {
      background: "var(--paper-sunk)",
      borderColor: "var(--hairline)",
      boxShadow: "none"
    },
    ghost: {
      background: "transparent",
      borderColor: "var(--hairline)",
      boxShadow: "none"
    },
    // `glass` is deprecated — Claude Design doesn't ship it. Behave as `raised`.
    glass: {
      background: "var(--paper-raised)",
      borderColor: "var(--hairline)",
      boxShadow: "var(--shadow-sm)"
    }
  };

  const Component = as;

  return (
    <Component
      data-tone={tone}
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-lg)",
        transition:
          "background-color 140ms cubic-bezier(0.2,0,0,1), color 140ms cubic-bezier(0.2,0,0,1), border-color 140ms ease",
        ...tones[tone],
        ...paddings[padding],
        ...style
      }}
      {...props}
    />
  );
}
