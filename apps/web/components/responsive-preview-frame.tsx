"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  clampViewport,
  getPresetViewport,
  presetViewports,
  type ResponsiveVariant,
  type ResponsiveViewport
} from "../lib/responsive-viewports";

export { presetViewports } from "../lib/responsive-viewports";
export type {
  ResponsiveVariant,
  ResponsiveViewport,
  ResponsiveViewportPreset
} from "../lib/responsive-viewports";

type PersistedSelection = {
  variant: ResponsiveVariant;
  viewport: ResponsiveViewport;
};

const STORAGE_PREFIX = "opendesign.responsivePreview.";

function storageKey(artifactId: string | undefined): string | null {
  if (!artifactId) return null;
  return `${STORAGE_PREFIX}${artifactId}`;
}

function readPersisted(artifactId: string | undefined): PersistedSelection | null {
  const key = storageKey(artifactId);
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSelection>;
    const variant = parsed?.variant;
    const isVariant =
      variant === "phone" ||
      variant === "tablet" ||
      variant === "laptop" ||
      variant === "desktop" ||
      variant === "fluid";
    if (!isVariant) return null;
    const viewport = clampViewport(parsed?.viewport ?? { width: 0, height: 0 });
    return { variant, viewport };
  } catch {
    return null;
  }
}

function writePersisted(artifactId: string | undefined, value: PersistedSelection) {
  const key = storageKey(artifactId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export type ResponsivePreviewFrameProps = {
  /** Current device variant. */
  variant: ResponsiveVariant;
  /** Current viewport in CSS pixels. */
  viewport: ResponsiveViewport;
  /** Called when the user picks a preset or edits the inputs. */
  onChange?: (next: { variant: ResponsiveVariant; viewport: ResponsiveViewport }) => void;
  /** Persist the last choice per artifact. */
  artifactId?: string;
  /** Content rendered inside the device chrome (canvas / preview). */
  children: ReactNode;
  /** Optional label announced to screen readers. */
  ariaLabel?: string;
  className?: string;
};

/**
 * Wraps Studio preview content in a scalable device shell. The child is
 * rendered at its natural (viewport) size and scaled down with CSS transforms
 * so it always fits its container — the child layout itself is unaffected.
 */
export function ResponsivePreviewFrame({
  variant,
  viewport,
  onChange,
  artifactId,
  children,
  ariaLabel,
  className
}: ResponsivePreviewFrameProps) {
  const [didHydrate, setDidHydrate] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>(
    { width: 0, height: 0 }
  );

  // Hydrate persisted selection once per artifact.
  useEffect(() => {
    if (didHydrate) return;
    setDidHydrate(true);
    const persisted = readPersisted(artifactId);
    if (persisted && onChange) {
      // Only emit if different from incoming props.
      if (
        persisted.variant !== variant ||
        persisted.viewport.width !== viewport.width ||
        persisted.viewport.height !== viewport.height
      ) {
        onChange(persisted);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId]);

  // Persist whenever variant/viewport change (after first hydrate).
  useEffect(() => {
    if (!didHydrate) return;
    writePersisted(artifactId, { variant, viewport });
  }, [artifactId, didHydrate, variant, viewport]);

  // Observe the outer container so we can compute a proportional scale.
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(node);
    // Seed initial size synchronously so we don't flash at scale 1.
    const rect = node.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
    return () => observer.disconnect();
  }, []);

  const isFluid = variant === "fluid";

  // For fluid we let the child occupy the full container; otherwise we scale
  // a fixed-size canvas to fit. Reserve ~40px of vertical bezel padding.
  const bezel = 12;
  const scale = useMemo(() => {
    if (isFluid) return 1;
    const availableW = Math.max(containerSize.width - bezel * 2, 1);
    const availableH = Math.max(containerSize.height - bezel * 2, 1);
    const raw = Math.min(availableW / viewport.width, availableH / viewport.height);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.min(raw, 1);
  }, [containerSize.height, containerSize.width, isFluid, viewport.height, viewport.width]);

  const frameStyle: CSSProperties = isFluid
    ? {
        width: "100%",
        height: "100%",
        borderRadius: 16,
        border: "1px solid rgba(127,127,127,0.25)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.03))",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        overflow: "hidden"
      }
    : {
        width: viewport.width,
        height: viewport.height,
        borderRadius: variant === "phone" ? 44 : variant === "tablet" ? 28 : 14,
        border: "1px solid rgba(127,127,127,0.35)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.04))",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.18), inset 0 0 0 6px rgba(127,127,127,0.12)",
        padding: bezel,
        overflow: "hidden",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        flexShrink: 0
      };

  const innerStyle: CSSProperties = isFluid
    ? { width: "100%", height: "100%" }
    : {
        width: viewport.width - bezel * 2,
        height: viewport.height - bezel * 2,
        borderRadius:
          variant === "phone" ? 32 : variant === "tablet" ? 18 : 8,
        overflow: "auto",
        background: "var(--surface, #fff)"
      };

  return (
    <div
      ref={containerRef}
      className={className}
      role="region"
      aria-label={ariaLabel ?? "Responsive preview frame"}
      data-variant={variant}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      <div style={frameStyle} aria-hidden={false}>
        <div style={innerStyle}>{children}</div>
      </div>
    </div>
  );
}

export type ResponsiveDeviceBarProps = {
  variant: ResponsiveVariant;
  viewport: ResponsiveViewport;
  onChange: (next: { variant: ResponsiveVariant; viewport: ResponsiveViewport }) => void;
  className?: string;
};

/**
 * Segmented control with the four presets + Fluid, followed by editable
 * width / height inputs. Pure controlled component — state lives with the
 * caller so the frame and bar can share it.
 */
export function ResponsiveDeviceBar({
  variant,
  viewport,
  onChange,
  className
}: ResponsiveDeviceBarProps) {
  const handleVariant = useCallback(
    (nextVariant: ResponsiveVariant) => {
      if (nextVariant === "fluid") {
        onChange({ variant: "fluid", viewport });
        return;
      }
      const preset = getPresetViewport(nextVariant);
      onChange({
        variant: nextVariant,
        viewport: preset ?? viewport
      });
    },
    [onChange, viewport]
  );

  const handleWidth = useCallback(
    (raw: string) => {
      const next = clampViewport({ width: Number(raw), height: viewport.height });
      onChange({ variant: "fluid", viewport: next });
    },
    [onChange, viewport.height]
  );

  const handleHeight = useCallback(
    (raw: string) => {
      const next = clampViewport({ width: viewport.width, height: Number(raw) });
      onChange({ variant: "fluid", viewport: next });
    },
    [onChange, viewport.width]
  );

  const buttonStyle = (active: boolean): CSSProperties => ({
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid rgba(127,127,127,0.3)",
    background: active ? "rgba(99,102,241,0.15)" : "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: "18px"
  });

  const inputStyle: CSSProperties = {
    width: 72,
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid rgba(127,127,127,0.3)",
    background: "transparent",
    color: "inherit",
    fontSize: 12
  };

  return (
    <div
      role="toolbar"
      aria-label="Responsive preview controls"
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }}
    >
      <div
        role="radiogroup"
        aria-label="Device preset"
        style={{ display: "inline-flex", gap: 4 }}
      >
        {presetViewports.map((preset) => {
          const active = variant === preset.variant;
          return (
            <button
              key={preset.variant}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${preset.label} preview (${preset.device}, ${preset.width} by ${preset.height})`}
              style={buttonStyle(active)}
              onClick={() => handleVariant(preset.variant)}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={variant === "fluid"}
          aria-label="Fluid preview, uses custom width and height"
          style={buttonStyle(variant === "fluid")}
          onClick={() => handleVariant("fluid")}
        >
          Fluid
        </button>
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        <span aria-hidden="true">W</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={viewport.width}
          onChange={(event) => handleWidth(event.target.value)}
          aria-label="Viewport width in pixels"
          style={inputStyle}
        />
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        <span aria-hidden="true">H</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={viewport.height}
          onChange={(event) => handleHeight(event.target.value)}
          aria-label="Viewport height in pixels"
          style={inputStyle}
        />
      </label>
    </div>
  );
}
