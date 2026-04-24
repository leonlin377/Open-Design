import { z } from "zod";

/**
 * Per-artifact theme contract — a designer-controlled bundle of palette,
 * typography, radius, and spacing tokens that travels with each artifact's
 * workspace. The shape is intentionally flat so client + exporter code can
 * blast it straight onto CSS variables without any intermediate mapping.
 */

const HexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u, {
    message: "Color must be a 3-, 6-, or 8-digit hex value prefixed with '#'."
  });

const FontStackSchema = z.string().min(1).max(256);

export const ArtifactThemePaletteSchema = z.object({
  surface: HexColorSchema,
  ink: HexColorSchema,
  accent: HexColorSchema,
  accentMuted: HexColorSchema,
  /** 10-stop neutral ramp from lightest (0) to darkest (9). */
  neutralRamp: z.array(HexColorSchema).length(10)
});

export const ArtifactThemeTypographyScaleSchema = z.object({
  xs: z.string().min(1),
  sm: z.string().min(1),
  base: z.string().min(1),
  md: z.string().min(1),
  lg: z.string().min(1),
  xl: z.string().min(1),
  "2xl": z.string().min(1),
  "3xl": z.string().min(1),
  display: z.string().min(1)
});

export const ArtifactThemeTypographySchema = z.object({
  fontDisplay: FontStackSchema,
  fontBody: FontStackSchema,
  fontMono: FontStackSchema,
  scale: ArtifactThemeTypographyScaleSchema
});

export const ArtifactThemeRadiusSchema = z.object({
  sm: z.string().min(1),
  md: z.string().min(1),
  lg: z.string().min(1),
  xl: z.string().min(1)
});

export const ArtifactThemeSpacingSchema = z.object({
  /** Base unit in pixels. Downstream consumers multiply `scale[i]` by `base`. */
  base: z.literal(4),
  scale: z.array(z.number().finite().nonnegative()).min(1)
});

export const ArtifactThemeSchema = z.object({
  palette: ArtifactThemePaletteSchema,
  typography: ArtifactThemeTypographySchema,
  radius: ArtifactThemeRadiusSchema,
  spacing: ArtifactThemeSpacingSchema
});

export type ArtifactTheme = z.infer<typeof ArtifactThemeSchema>;
export type ArtifactThemePalette = z.infer<typeof ArtifactThemePaletteSchema>;
export type ArtifactThemeTypography = z.infer<typeof ArtifactThemeTypographySchema>;
export type ArtifactThemeTypographyScale = z.infer<
  typeof ArtifactThemeTypographyScaleSchema
>;
export type ArtifactThemeRadius = z.infer<typeof ArtifactThemeRadiusSchema>;
export type ArtifactThemeSpacing = z.infer<typeof ArtifactThemeSpacingSchema>;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const DEFAULT_TYPOGRAPHY_SCALE: ArtifactThemeTypographyScale = {
  xs: "12px",
  sm: "14px",
  base: "16px",
  md: "18px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "40px",
  display: "56px"
};

const DEFAULT_RADIUS: ArtifactThemeRadius = {
  sm: "4px",
  md: "8px",
  lg: "16px",
  xl: "24px"
};

const DEFAULT_SPACING: ArtifactThemeSpacing = {
  base: 4,
  scale: [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
};

const FONT_STACK_SANS =
  "'Inter', 'Helvetica Neue', Arial, system-ui, -apple-system, sans-serif";
const FONT_STACK_SERIF =
  "'Source Serif Pro', 'Iowan Old Style', Georgia, 'Times New Roman', serif";
const FONT_STACK_DISPLAY =
  "'Canela Deck', 'Playfair Display', 'Didot', 'Times New Roman', serif";
const FONT_STACK_MONO =
  "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace";

function buildTypography(input: {
  fontDisplay: string;
  fontBody: string;
  fontMono?: string;
}): ArtifactThemeTypography {
  return {
    fontDisplay: input.fontDisplay,
    fontBody: input.fontBody,
    fontMono: input.fontMono ?? FONT_STACK_MONO,
    scale: { ...DEFAULT_TYPOGRAPHY_SCALE }
  };
}

/**
 * "Paper" — warm off-white surface with deep charcoal ink and a crimson accent.
 * Surface #FAF7F2 vs. ink #1A1915 → contrast ratio ≈ 17.8:1.
 */
const PAPER_PALETTE: ArtifactThemePalette = {
  surface: "#FAF7F2",
  ink: "#1A1915",
  accent: "#C2410C",
  accentMuted: "#FED7AA",
  neutralRamp: [
    "#FAF7F2",
    "#F2EEE6",
    "#E7E2D6",
    "#D3CDBE",
    "#B3AC9C",
    "#8A8474",
    "#615C50",
    "#423E34",
    "#2A271F",
    "#1A1915"
  ]
};

/**
 * "Ink" — near-black surface, bone ink, electric indigo accent.
 * Surface #0B0B0E vs. ink #E8E6E1 → contrast ratio ≈ 16.4:1.
 */
const INK_PALETTE: ArtifactThemePalette = {
  surface: "#0B0B0E",
  ink: "#E8E6E1",
  accent: "#8B5CF6",
  accentMuted: "#4C1D95",
  neutralRamp: [
    "#0B0B0E",
    "#161619",
    "#22222A",
    "#2F2F38",
    "#444450",
    "#6B6B7A",
    "#9A9AA6",
    "#C4C4CC",
    "#DCDCE2",
    "#E8E6E1"
  ]
};

/**
 * "Teal" — cool misty surface with slate ink and sea-green accent.
 * Surface #F1F7F6 vs. ink #0F2A2E → contrast ratio ≈ 15.9:1.
 */
const TEAL_PALETTE: ArtifactThemePalette = {
  surface: "#F1F7F6",
  ink: "#0F2A2E",
  accent: "#0D9488",
  accentMuted: "#99F6E4",
  neutralRamp: [
    "#F1F7F6",
    "#E2EDEC",
    "#CCDEDC",
    "#A8C6C3",
    "#7FA5A1",
    "#547E7A",
    "#3A5F5C",
    "#264644",
    "#17332F",
    "#0F2A2E"
  ]
};

/**
 * "Sunset" — peach surface, aubergine ink, orange accent.
 * Surface #FFF4EC vs. ink #261214 → contrast ratio ≈ 15.3:1.
 */
const SUNSET_PALETTE: ArtifactThemePalette = {
  surface: "#FFF4EC",
  ink: "#261214",
  accent: "#EA580C",
  accentMuted: "#FDBA74",
  neutralRamp: [
    "#FFF4EC",
    "#FCE7D5",
    "#F7D2B4",
    "#EEB48A",
    "#D88863",
    "#B1604A",
    "#814134",
    "#552924",
    "#371A1A",
    "#261214"
  ]
};

/**
 * "Monochrome" — pure white surface, near-black ink, grayscale accent.
 * Surface #FFFFFF vs. ink #0A0A0A → contrast ratio ≈ 20.3:1.
 */
const MONOCHROME_PALETTE: ArtifactThemePalette = {
  surface: "#FFFFFF",
  ink: "#0A0A0A",
  accent: "#171717",
  accentMuted: "#A3A3A3",
  neutralRamp: [
    "#FFFFFF",
    "#F5F5F5",
    "#E5E5E5",
    "#D4D4D4",
    "#A3A3A3",
    "#737373",
    "#525252",
    "#404040",
    "#262626",
    "#0A0A0A"
  ]
};

/**
 * "Forest" — mint surface, pine ink, moss accent.
 * Surface #F3F7F1 vs. ink #132016 → contrast ratio ≈ 16.2:1.
 */
const FOREST_PALETTE: ArtifactThemePalette = {
  surface: "#F3F7F1",
  ink: "#132016",
  accent: "#16A34A",
  accentMuted: "#BBF7D0",
  neutralRamp: [
    "#F3F7F1",
    "#E4EEE0",
    "#C9DCC2",
    "#A6C39B",
    "#7FA475",
    "#558355",
    "#3A623E",
    "#26432C",
    "#1A2E20",
    "#132016"
  ]
};

export const ARTIFACT_THEME_PRESET_NAMES = [
  "Paper",
  "Ink",
  "Teal",
  "Sunset",
  "Monochrome",
  "Forest"
] as const;

export type ArtifactThemePresetName = (typeof ARTIFACT_THEME_PRESET_NAMES)[number];

export const ARTIFACT_THEME_PRESETS: Record<ArtifactThemePresetName, ArtifactTheme> = {
  Paper: ArtifactThemeSchema.parse({
    palette: PAPER_PALETTE,
    typography: buildTypography({
      fontDisplay: FONT_STACK_DISPLAY,
      fontBody: FONT_STACK_SERIF
    }),
    radius: { ...DEFAULT_RADIUS },
    spacing: { ...DEFAULT_SPACING, scale: [...DEFAULT_SPACING.scale] }
  }),
  Ink: ArtifactThemeSchema.parse({
    palette: INK_PALETTE,
    typography: buildTypography({
      fontDisplay: FONT_STACK_SANS,
      fontBody: FONT_STACK_SANS
    }),
    radius: { sm: "2px", md: "4px", lg: "8px", xl: "16px" },
    spacing: { ...DEFAULT_SPACING, scale: [...DEFAULT_SPACING.scale] }
  }),
  Teal: ArtifactThemeSchema.parse({
    palette: TEAL_PALETTE,
    typography: buildTypography({
      fontDisplay: FONT_STACK_SANS,
      fontBody: FONT_STACK_SANS
    }),
    radius: { ...DEFAULT_RADIUS },
    spacing: { ...DEFAULT_SPACING, scale: [...DEFAULT_SPACING.scale] }
  }),
  Sunset: ArtifactThemeSchema.parse({
    palette: SUNSET_PALETTE,
    typography: buildTypography({
      fontDisplay: FONT_STACK_DISPLAY,
      fontBody: FONT_STACK_SANS
    }),
    radius: { sm: "6px", md: "12px", lg: "20px", xl: "32px" },
    spacing: { ...DEFAULT_SPACING, scale: [...DEFAULT_SPACING.scale] }
  }),
  Monochrome: ArtifactThemeSchema.parse({
    palette: MONOCHROME_PALETTE,
    typography: buildTypography({
      fontDisplay: FONT_STACK_SANS,
      fontBody: FONT_STACK_SANS
    }),
    radius: { sm: "0px", md: "0px", lg: "2px", xl: "4px" },
    spacing: { ...DEFAULT_SPACING, scale: [...DEFAULT_SPACING.scale] }
  }),
  Forest: ArtifactThemeSchema.parse({
    palette: FOREST_PALETTE,
    typography: buildTypography({
      fontDisplay: FONT_STACK_SERIF,
      fontBody: FONT_STACK_SANS
    }),
    radius: { ...DEFAULT_RADIUS },
    spacing: { ...DEFAULT_SPACING, scale: [...DEFAULT_SPACING.scale] }
  })
};

/**
 * The "Paper" preset doubles as the default an artifact renders with until a
 * designer explicitly picks something else.
 */
export const DEFAULT_ARTIFACT_THEME: ArtifactTheme = ARTIFACT_THEME_PRESETS.Paper;
