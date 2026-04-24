// Responsive viewport presets used by the Studio preview frame. Kept as a
// plain module (no React imports) so it stays tree-shakeable and usable from
// server components that only need the constants.

export type ResponsiveVariant = "phone" | "tablet" | "laptop" | "desktop" | "fluid";

export type ResponsiveViewport = {
  width: number;
  height: number;
};

export type ResponsiveViewportPreset = ResponsiveViewport & {
  variant: Exclude<ResponsiveVariant, "fluid">;
  label: string;
  /** Short description, e.g. the physical reference device. */
  device: string;
};

// Exact pixel (CSS px) dimensions. These match the canonical logical
// viewport sizes we target in the Studio preview:
//   - iPhone 14:        390 x 844
//   - iPad Air:         820 x 1180
//   - 13" laptop:       1280 x 800
//   - 27" display:      2560 x 1440
export const presetViewports: readonly ResponsiveViewportPreset[] = [
  {
    variant: "phone",
    label: "Phone",
    device: "iPhone 14",
    width: 390,
    height: 844
  },
  {
    variant: "tablet",
    label: "Tablet",
    device: "iPad Air",
    width: 820,
    height: 1180
  },
  {
    variant: "laptop",
    label: "Laptop",
    device: '13" laptop',
    width: 1280,
    height: 800
  },
  {
    variant: "desktop",
    label: "Desktop",
    device: '27" display',
    width: 2560,
    height: 1440
  }
] as const;

export const MIN_VIEWPORT_WIDTH = 240;
export const MAX_VIEWPORT_WIDTH = 4096;
export const MIN_VIEWPORT_HEIGHT = 320;
export const MAX_VIEWPORT_HEIGHT = 4096;

/**
 * Clamp a viewport to the supported range and coerce NaN/negative values to a
 * sensible default. Never returns non-finite numbers.
 */
export function clampViewport(viewport: Partial<ResponsiveViewport>): ResponsiveViewport {
  const rawWidth = Number(viewport.width);
  const rawHeight = Number(viewport.height);
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : MIN_VIEWPORT_WIDTH;
  const height =
    Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : MIN_VIEWPORT_HEIGHT;
  return {
    width: Math.round(Math.min(Math.max(width, MIN_VIEWPORT_WIDTH), MAX_VIEWPORT_WIDTH)),
    height: Math.round(
      Math.min(Math.max(height, MIN_VIEWPORT_HEIGHT), MAX_VIEWPORT_HEIGHT)
    )
  };
}

export function getPresetViewport(
  variant: ResponsiveVariant
): ResponsiveViewport | null {
  if (variant === "fluid") return null;
  const preset = presetViewports.find((entry) => entry.variant === variant);
  return preset ? { width: preset.width, height: preset.height } : null;
}
