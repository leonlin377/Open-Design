/**
 * OpenDesign design tokens — runtime TS catalog.
 *
 * Identity (BRAND-001, 2026-04-20): warm paper +
 * Rauno Freiberg craft details + Emil Kowalski motion primitives.
 *
 * This file is the TypeScript mirror of the canonical CSS token source at
 * `apps/web/app/tokens.css`. The CSS remains the source of truth for styling;
 * this file exists so scene-engine, exporters, and plan renderers can read
 * the same catalog at runtime without parsing CSS.
 *
 * Types are intentionally strict: no `any`, no looseness. When you add a
 * semantic token, update both the type and the value.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export interface PaperRamp {
  readonly paper: string;
  readonly paperSunk: string;
  readonly paperRaised: string;
}

export interface InkRamp {
  readonly ink1: string;
  readonly ink2: string;
  readonly ink3: string;
  readonly ink4: string;
}

export interface RustAccent {
  readonly rust: string;
  readonly rustHover: string;
  readonly rustSoft: string;
  readonly rustContrast: string;
}

export interface SemanticColors {
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly info: string;
  readonly signalLive: string;
}

export interface ThemePalette {
  readonly paper: PaperRamp;
  readonly ink: InkRamp;
  readonly hairline: string;
  readonly accent: RustAccent;
  readonly semantic: SemanticColors;
}

export interface Palette {
  readonly light: ThemePalette;
  readonly dark: ThemePalette;
}

export const palette: Palette = {
  light: {
    paper: {
      paper: "#F5F1EB",
      paperSunk: "#EAE3D6",
      paperRaised: "#FDFAF4",
    },
    ink: {
      ink1: "#1A1713",
      ink2: "#5C5348",
      ink3: "#8A8070",
      ink4: "#B8AE9D",
    },
    hairline: "#E3DCCB",
    accent: {
      rust: "#C87E4F",
      rustHover: "#B67244",
      rustSoft: "#F0E0CF",
      rustContrast: "#FFFFFF",
    },
    semantic: {
      success: "#5F8A5C",
      warning: "#7A5A12",
      danger: "#C84734",
      info: "#3E6B9C",
      signalLive: "#35B46C",
    },
  },
  dark: {
    paper: {
      paper: "#1F1B15",
      paperSunk: "#17140F",
      paperRaised: "#2A2520",
    },
    ink: {
      ink1: "#F0E8D8",
      ink2: "#B8AE9D",
      ink3: "#8A8070",
      ink4: "#5C5348",
    },
    hairline: "#3A342C",
    accent: {
      rust: "#E09060",
      rustHover: "#EBA374",
      rustSoft: "#3D2E1F",
      rustContrast: "#1A1713",
    },
    semantic: {
      success: "#8AB57E",
      warning: "#E5B757",
      danger: "#E07563",
      info: "#6FA3D6",
      signalLive: "#4FD185",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Type scale — named usage tokens
// ---------------------------------------------------------------------------

export type TypeFamily = "display" | "sans" | "mono";

export interface TypeToken {
  readonly family: TypeFamily;
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly lineHeight: number;
  readonly letterSpacing: string;
  readonly fontWeight: number;
  readonly transform?: "uppercase";
  readonly features?: readonly string[];
}

export type TypeScaleName =
  | "display"
  | "titleL"
  | "titleM"
  | "titleS"
  | "bodyL"
  | "body"
  | "bodyS"
  | "label"
  | "caption"
  | "monoLabel"
  | "data";

export type TypeScale = Readonly<Record<TypeScaleName, TypeToken>>;

const FONT_DISPLAY =
  '"Instrument Serif", "Iowan Old Style", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", Georgia, serif';
const FONT_SANS =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif';
const FONT_MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';

export const typeScale: TypeScale = {
  display: {
    family: "display",
    fontFamily: FONT_DISPLAY,
    fontSize: "clamp(44px, 6vw, 72px)",
    lineHeight: 1.02,
    letterSpacing: "-0.02em",
    fontWeight: 400,
  },
  titleL: {
    family: "display",
    fontFamily: FONT_DISPLAY,
    fontSize: "clamp(34px, 4vw, 44px)",
    lineHeight: 1.15,
    letterSpacing: "-0.012em",
    fontWeight: 400,
  },
  titleM: {
    family: "sans",
    fontFamily: FONT_SANS,
    fontSize: "22px",
    lineHeight: 1.3,
    letterSpacing: "-0.005em",
    fontWeight: 600,
  },
  titleS: {
    family: "sans",
    fontFamily: FONT_SANS,
    fontSize: "18px",
    lineHeight: 1.3,
    letterSpacing: "0",
    fontWeight: 600,
  },
  bodyL: {
    family: "sans",
    fontFamily: FONT_SANS,
    fontSize: "17px",
    lineHeight: 1.55,
    letterSpacing: "0",
    fontWeight: 400,
  },
  body: {
    family: "sans",
    fontFamily: FONT_SANS,
    fontSize: "15px",
    lineHeight: 1.55,
    letterSpacing: "0",
    fontWeight: 400,
  },
  bodyS: {
    family: "sans",
    fontFamily: FONT_SANS,
    fontSize: "13.5px",
    lineHeight: 1.5,
    letterSpacing: "0",
    fontWeight: 400,
  },
  label: {
    family: "sans",
    fontFamily: FONT_SANS,
    fontSize: "13px",
    lineHeight: 1.3,
    letterSpacing: "0",
    fontWeight: 500,
  },
  caption: {
    family: "sans",
    fontFamily: FONT_SANS,
    fontSize: "12px",
    lineHeight: 1.4,
    letterSpacing: "0.02em",
    fontWeight: 400,
  },
  monoLabel: {
    family: "mono",
    fontFamily: FONT_MONO,
    fontSize: "11.5px",
    lineHeight: 1.3,
    letterSpacing: "0.08em",
    fontWeight: 500,
    transform: "uppercase",
  },
  data: {
    family: "mono",
    fontFamily: FONT_MONO,
    fontSize: "13px",
    lineHeight: 1.4,
    letterSpacing: "0",
    fontWeight: 400,
    features: ["tnum", "zero"],
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing scale (4px baseline)
// ---------------------------------------------------------------------------

export const space: readonly number[] = [
  0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128, 160, 192, 240,
  320,
] as const;

export type SpaceIndex =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20;

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

export type RadiusName = "sm" | "md" | "lg" | "xl" | "pill";

export const radius: Readonly<Record<RadiusName, number>> = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

export type ShadowName = "sm" | "md";

export interface ShadowSet {
  readonly sm: string;
  readonly md: string;
}

export interface Shadow {
  readonly light: ShadowSet;
  readonly dark: ShadowSet;
}

export const shadow: Shadow = {
  light: {
    sm: "0 1px 2px rgba(26, 23, 19, 0.06)",
    md: "0 4px 12px rgba(26, 23, 19, 0.08)",
  },
  dark: {
    sm: "0 2px 4px rgba(0, 0, 0, 0.35)",
    md: "0 8px 20px rgba(0, 0, 0, 0.45)",
  },
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export type MotionName =
  | "quick"
  | "base"
  | "enter"
  | "exit"
  | "spring"
  | "indicator"
  | "blink"
  | "reduce";

export interface MotionToken {
  readonly duration: number;
  readonly easing: string;
}

export const motion: Readonly<Record<MotionName, MotionToken>> = {
  quick: { duration: 120, easing: "cubic-bezier(0.2,0,0,1)" },
  base: { duration: 180, easing: "cubic-bezier(0.2,0,0,1)" },
  enter: { duration: 230, easing: "cubic-bezier(0.2,0,0,1)" },
  exit: { duration: 180, easing: "cubic-bezier(0.4,0,1,1)" },
  spring: { duration: 280, easing: "cubic-bezier(0.3,1.4,0.5,1)" },
  indicator: { duration: 2000, easing: "cubic-bezier(0.2,0,0,1)" },
  blink: { duration: 1050, easing: "cubic-bezier(0,0,0,1)" },
  reduce: { duration: 1, easing: "linear" },
} as const;

// ---------------------------------------------------------------------------
// Breakpoints
// ---------------------------------------------------------------------------

export type BreakpointName = "sm" | "md" | "lg" | "xl" | "2xl";

export interface BreakpointToken {
  readonly breakpoint: number;
  readonly pageMax: number | "100%";
}

export const breakpoints: Readonly<Record<BreakpointName, BreakpointToken>> = {
  sm: { breakpoint: 640, pageMax: "100%" },
  md: { breakpoint: 860, pageMax: 720 },
  lg: { breakpoint: 1040, pageMax: 960 },
  xl: { breakpoint: 1280, pageMax: 1040 },
  "2xl": { breakpoint: 1600, pageMax: 1120 },
} as const;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

export interface Icons {
  readonly sizes: readonly number[];
  readonly strokeWidth: number;
  readonly style: "outline";
}

export const icons: Icons = {
  sizes: [14, 16, 18, 20, 24] as const,
  strokeWidth: 1.5,
  style: "outline",
} as const;

// ---------------------------------------------------------------------------
// Default bundle
// ---------------------------------------------------------------------------

export interface Tokens {
  readonly palette: Palette;
  readonly typeScale: TypeScale;
  readonly space: readonly number[];
  readonly radius: Readonly<Record<RadiusName, number>>;
  readonly shadow: Shadow;
  readonly motion: Readonly<Record<MotionName, MotionToken>>;
  readonly breakpoints: Readonly<Record<BreakpointName, BreakpointToken>>;
  readonly icons: Icons;
}

export const tokens: Tokens = {
  palette,
  typeScale,
  space,
  radius,
  shadow,
  motion,
  breakpoints,
  icons,
} as const;

export default tokens;
