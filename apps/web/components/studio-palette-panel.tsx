"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { Button, Surface } from "@opendesign/ui";
import {
  applyThemeToElement,
  saveArtifactTheme,
  themeToCssVariables,
  type OpenDesignTheme
} from "../lib/opendesign-theme";

type StudioPalettePanelProps = {
  projectId: string;
  artifactId: string;
  initialTheme: OpenDesignTheme;
  /**
   * The set of named presets shipped by the server-side contract. Passed in
   * rather than imported so this component's client bundle does not pull the
   * entire Zod schema in; the Studio page provides them from its server render.
   */
  presets: Array<{ name: string; theme: OpenDesignTheme }>;
  /**
   * Font-pair catalogue — each entry is a (display, body) stack pair the user
   * can apply with one click. Provided by the Studio page so fresh pairings
   * can ship without touching this component.
   */
  fontPairs: Array<{ id: string; label: string; display: string; body: string }>;
  /**
   * Optional callback fired after a successful POST so the parent can refresh
   * the canvas preview, exports, etc.
   */
  onThemeSaved?: (theme: OpenDesignTheme) => void;
};

type PaletteSwatchKey = "surface" | "ink" | "accent" | "accentMuted";

const SWATCH_FIELDS: Array<{ key: PaletteSwatchKey; label: string }> = [
  { key: "surface", label: "Surface" },
  { key: "ink", label: "Ink" },
  { key: "accent", label: "Accent" },
  { key: "accentMuted", label: "Accent (muted)" }
];

function sanitizeHex(value: string): string | null {
  const trimmed = value.trim();
  const match = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u.exec(trimmed);
  return match ? trimmed : null;
}

export function StudioPalettePanel({
  projectId,
  artifactId,
  initialTheme,
  presets,
  fontPairs,
  onThemeSaved
}: StudioPalettePanelProps) {
  const [theme, setTheme] = useState<OpenDesignTheme>(initialTheme);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Keep the preview block in sync with the currently-edited theme. This is
  // the same `applyThemeToElement` exporters call — so the preview is a true
  // reduction of the export pipeline rather than a bespoke render.
  useEffect(() => {
    applyThemeToElement(previewRef.current, theme);
  }, [theme]);

  const previewStyle = useMemo<CSSProperties>(() => {
    const vars = themeToCssVariables(theme);
    return vars as CSSProperties;
  }, [theme]);

  const applyPreset = useCallback(
    (preset: OpenDesignTheme) => {
      setTheme(preset);
      setStatus("idle");
      setErrorMessage(null);
    },
    []
  );

  const activePresetName = useMemo(() => {
    for (const preset of presets) {
      if (
        preset.theme.palette.surface === theme.palette.surface &&
        preset.theme.palette.ink === theme.palette.ink &&
        preset.theme.palette.accent === theme.palette.accent
      ) {
        return preset.name;
      }
    }
    return null;
  }, [presets, theme]);

  function updateSwatch(key: PaletteSwatchKey, value: string) {
    const hex = sanitizeHex(value);
    if (!hex) {
      // Reject malformed input without resetting — color pickers always send
      // a valid hex, but a typed paste can arrive half-baked.
      return;
    }
    setTheme((previous) => ({
      ...previous,
      palette: {
        ...previous.palette,
        [key]: hex
      }
    }));
  }

  function updateFontPair(pairId: string) {
    const match = fontPairs.find((entry) => entry.id === pairId);
    if (!match) {
      return;
    }
    setTheme((previous) => ({
      ...previous,
      typography: {
        ...previous.typography,
        fontDisplay: match.display,
        fontBody: match.body
      }
    }));
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMessage(null);
    try {
      const result = await saveArtifactTheme({
        projectId,
        artifactId,
        theme
      });
      setTheme(result.theme);
      setStatus("saved");
      onThemeSaved?.(result.theme);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>Palette & Typography</h3>
        <p className="footer-note">
          Preview changes live, then save to persist the theme onto this artifact.
          Canvas and exports consume the same CSS variables.
        </p>
      </div>

      <div className="stack-form">
        <div>
          <span className="field-label">Preset</span>
          <div className="preset-grid">
            {presets.map((preset) => {
              const isActive = activePresetName === preset.name;
              return (
                <button
                  key={preset.name}
                  type="button"
                  className={
                    isActive ? "preset-chip preset-chip-active" : "preset-chip"
                  }
                  onClick={() => applyPreset(preset.theme)}
                  aria-pressed={isActive}
                  style={
                    {
                      ["--preset-surface" as string]: preset.theme.palette.surface,
                      ["--preset-ink" as string]: preset.theme.palette.ink,
                      ["--preset-accent" as string]: preset.theme.palette.accent
                    } as CSSProperties
                  }
                >
                  <span className="preset-swatch" aria-hidden="true">
                    <span
                      className="preset-swatch-dot"
                      style={{ background: preset.theme.palette.surface }}
                    />
                    <span
                      className="preset-swatch-dot"
                      style={{ background: preset.theme.palette.ink }}
                    />
                    <span
                      className="preset-swatch-dot"
                      style={{ background: preset.theme.palette.accent }}
                    />
                  </span>
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="field-label">Colors</span>
          <div className="swatch-grid">
            {SWATCH_FIELDS.map((field) => (
              <label key={field.key} className="field swatch-field">
                <span>{field.label}</span>
                <span className="swatch-row">
                  <input
                    type="color"
                    value={theme.palette[field.key]}
                    onChange={(event) => updateSwatch(field.key, event.target.value)}
                    aria-label={`${field.label} color`}
                  />
                  <input
                    type="text"
                    value={theme.palette[field.key]}
                    onChange={(event) => updateSwatch(field.key, event.target.value)}
                    spellCheck={false}
                    className="swatch-hex"
                  />
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Font pairing</span>
          <select
            value={
              fontPairs.find(
                (pair) =>
                  pair.display === theme.typography.fontDisplay &&
                  pair.body === theme.typography.fontBody
              )?.id ?? ""
            }
            onChange={(event) => updateFontPair(event.target.value)}
          >
            <option value="">Custom</option>
            {fontPairs.map((pair) => (
              <option key={pair.id} value={pair.id}>
                {pair.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={previewRef}
        className="palette-preview"
        style={{
          ...previewStyle,
          background: "var(--color-surface)",
          color: "var(--color-ink)",
          fontFamily: "var(--font-body)",
          padding: "var(--space-5, 24px)",
          borderRadius: "var(--radius-lg)"
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-2xl)",
            lineHeight: 1.1
          }}
        >
          Aa — the quick preview.
        </div>
        <div
          style={{
            marginTop: "var(--space-3, 12px)",
            fontSize: "var(--font-size-base)"
          }}
        >
          Body copy samples the paired body stack against the chosen surface and
          ink tones.
        </div>
        <div
          style={{
            marginTop: "var(--space-4, 16px)",
            display: "inline-block",
            padding: "var(--space-2, 8px) var(--space-4, 16px)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-accent)",
            color: "var(--color-surface)",
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-sm)"
          }}
        >
          Accent chip
        </div>
      </div>

      <div className="studio-status-row">
        <Button variant="primary" type="button" onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save theme"}
        </Button>
        {status === "saved" ? (
          <span className="status-pill success">Saved</span>
        ) : null}
        {status === "error" ? (
          <span className="status-pill error">{errorMessage ?? "Save failed"}</span>
        ) : null}
      </div>
    </Surface>
  );
}
