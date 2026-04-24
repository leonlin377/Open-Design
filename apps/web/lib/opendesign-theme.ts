/**
 * Client helpers for consuming the per-artifact theme. The contract mirrors
 * `@opendesign/contracts/src/artifact-theme` — we intentionally re-declare the
 * minimal shape here so client bundles can import this file without pulling
 * the full Zod schema into the UI chunk.
 */

export interface OpenDesignThemePalette {
  surface: string;
  ink: string;
  accent: string;
  accentMuted: string;
  neutralRamp: string[];
}

export interface OpenDesignThemeTypographyScale {
  xs: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  "3xl": string;
  display: string;
}

export interface OpenDesignThemeTypography {
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  scale: OpenDesignThemeTypographyScale;
}

export interface OpenDesignThemeRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface OpenDesignThemeSpacing {
  base: 4;
  scale: number[];
}

export interface OpenDesignTheme {
  palette: OpenDesignThemePalette;
  typography: OpenDesignThemeTypography;
  radius: OpenDesignThemeRadius;
  spacing: OpenDesignThemeSpacing;
}

/**
 * Flat record of CSS custom properties derived from an {@link OpenDesignTheme}.
 * The `--color-*`, `--font-*`, `--font-size-*`, `--radius-*`, and `--space-*`
 * namespaces are the stable contract; canvas previews and exported bundles are
 * free to reference any of them.
 */
export type OpenDesignThemeCssVars = Record<`--${string}`, string>;

export function themeToCssVariables(theme: OpenDesignTheme): OpenDesignThemeCssVars {
  const vars: OpenDesignThemeCssVars = {
    "--color-surface": theme.palette.surface,
    "--color-ink": theme.palette.ink,
    "--color-accent": theme.palette.accent,
    "--color-accent-muted": theme.palette.accentMuted,
    "--font-display": theme.typography.fontDisplay,
    "--font-body": theme.typography.fontBody,
    "--font-mono": theme.typography.fontMono,
    "--font-size-xs": theme.typography.scale.xs,
    "--font-size-sm": theme.typography.scale.sm,
    "--font-size-base": theme.typography.scale.base,
    "--font-size-md": theme.typography.scale.md,
    "--font-size-lg": theme.typography.scale.lg,
    "--font-size-xl": theme.typography.scale.xl,
    "--font-size-2xl": theme.typography.scale["2xl"],
    "--font-size-3xl": theme.typography.scale["3xl"],
    "--font-size-display": theme.typography.scale.display,
    "--radius-sm": theme.radius.sm,
    "--radius-md": theme.radius.md,
    "--radius-lg": theme.radius.lg,
    "--radius-xl": theme.radius.xl,
    "--space-base": `${theme.spacing.base}px`
  };

  theme.palette.neutralRamp.forEach((value, index) => {
    vars[`--color-neutral-${index}`] = value;
  });

  theme.spacing.scale.forEach((step, index) => {
    vars[`--space-${index}`] = `${step * theme.spacing.base}px`;
  });

  return vars;
}

/**
 * Writes every variable derived from {@link theme} onto {@link element}'s
 * inline style. Used by the preview surface and the static HTML exporter — both
 * end up with the same CSS variable contract so a theme change reflows both.
 */
export function applyThemeToElement(
  element: HTMLElement | null | undefined,
  theme: OpenDesignTheme
): void {
  if (!element) {
    return;
  }

  const vars = themeToCssVariables(theme);
  for (const [name, value] of Object.entries(vars)) {
    element.style.setProperty(name, value);
  }
}

/**
 * Serializes a theme as a single `style=""` string suitable for SSR and for
 * embedding on the root element of an HTML export. The order mirrors
 * `themeToCssVariables`, which keeps output diff-friendly.
 */
export function themeToInlineStyle(theme: OpenDesignTheme): string {
  return Object.entries(themeToCssVariables(theme))
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
}

export interface FetchedArtifactTheme {
  artifactId: string;
  theme: OpenDesignTheme;
  isDefault: boolean;
  updatedAt: string | null;
}

export async function fetchArtifactTheme(input: {
  projectId: string;
  artifactId: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<FetchedArtifactTheme> {
  const fetcher = input.fetchImpl ?? fetch;
  const prefix = input.baseUrl ? input.baseUrl.replace(/\/+$/, "") : "";
  const url = `${prefix}/api/projects/${encodeURIComponent(
    input.projectId
  )}/artifacts/${encodeURIComponent(input.artifactId)}/theme`;
  const response = await fetcher(url, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Failed to load theme (${response.status}).`);
  }

  return (await response.json()) as FetchedArtifactTheme;
}

export async function saveArtifactTheme(input: {
  projectId: string;
  artifactId: string;
  theme: OpenDesignTheme;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<FetchedArtifactTheme> {
  const fetcher = input.fetchImpl ?? fetch;
  const prefix = input.baseUrl ? input.baseUrl.replace(/\/+$/, "") : "";
  const url = `${prefix}/api/projects/${encodeURIComponent(
    input.projectId
  )}/artifacts/${encodeURIComponent(input.artifactId)}/theme`;
  const response = await fetcher(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ theme: input.theme })
  });

  if (!response.ok) {
    throw new Error(`Failed to save theme (${response.status}).`);
  }

  return (await response.json()) as FetchedArtifactTheme;
}
