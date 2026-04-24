"use client";

import * as React from "react";
import { Grid, Stack, Text } from "@opendesign/ui";
import {
  palette,
  type ThemePalette
} from "../../../../../packages/ui/src/tokens";
import { SectionShell } from "./section";
import styles from "../styleguide.module.css";

// ---------------------------------------------------------------------------
// WCAG helpers — small enough to live here. sRGB -> relative luminance.
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): readonly [number, number, number] {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const int = parseInt(normalized, 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff] as const;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

type SwatchSpec = {
  readonly label: string;
  readonly token: string;
  readonly hex: string;
};

type SwatchProps = SwatchSpec & {
  readonly surface: string;
  readonly textColor: string;
};

function Swatch({ label, token, hex, surface, textColor }: SwatchProps) {
  const ratio = contrastRatio(hex, surface);
  const pass = ratio >= 4.5;
  return (
    <div
      className={styles.swatch}
      style={{
        background: surface,
        borderColor: "color-mix(in oklab, currentColor 15%, transparent)",
        color: textColor
      }}
    >
      <div
        className={styles.swatchBlock}
        style={{ background: hex, borderColor: "color-mix(in oklab, #000 10%, transparent)" }}
      />
      <div className={styles.swatchMeta} style={{ color: "inherit", opacity: 0.75 }}>
        <span className={styles.swatchLabel} style={{ color: "inherit", opacity: 1 }}>
          {label}
        </span>
        <span className={styles.swatchHex}>{hex.toUpperCase()}</span>
        <span>{token}</span>
        <span className={styles.swatchRatio}>
          <span
            className={styles.swatchRatioPill}
            data-pass={pass ? "pass" : "fail"}
          >
            {ratio.toFixed(2)}:1
          </span>
          <span style={{ opacity: 0.6 }}>vs surface</span>
        </span>
      </div>
    </div>
  );
}

function buildSwatches(theme: ThemePalette): readonly SwatchSpec[] {
  return [
    { label: "Paper", token: "paper.paper", hex: theme.paper.paper },
    { label: "Paper · raised", token: "paper.paperRaised", hex: theme.paper.paperRaised },
    { label: "Paper · sunk", token: "paper.paperSunk", hex: theme.paper.paperSunk },
    { label: "Ink 1", token: "ink.ink1", hex: theme.ink.ink1 },
    { label: "Ink 2", token: "ink.ink2", hex: theme.ink.ink2 },
    { label: "Ink 3", token: "ink.ink3", hex: theme.ink.ink3 },
    { label: "Ink 4", token: "ink.ink4", hex: theme.ink.ink4 },
    { label: "Hairline", token: "hairline", hex: theme.hairline },
    { label: "Rust", token: "accent.rust", hex: theme.accent.rust },
    { label: "Rust · hover", token: "accent.rustHover", hex: theme.accent.rustHover },
    { label: "Rust · soft", token: "accent.rustSoft", hex: theme.accent.rustSoft },
    { label: "Rust · contrast", token: "accent.rustContrast", hex: theme.accent.rustContrast },
    { label: "Signal · live", token: "semantic.signalLive", hex: theme.semantic.signalLive },
    { label: "Success", token: "semantic.success", hex: theme.semantic.success },
    { label: "Warning", token: "semantic.warning", hex: theme.semantic.warning },
    { label: "Danger", token: "semantic.danger", hex: theme.semantic.danger },
    { label: "Info", token: "semantic.info", hex: theme.semantic.info }
  ] as const;
}

function ThemeGrid({
  theme,
  mode
}: {
  theme: ThemePalette;
  mode: "light" | "dark";
}) {
  const surface = theme.paper.paper;
  const textColor = theme.ink.ink1;
  const label = mode === "light" ? "Light · paper" : "Dark · paper";
  const cardClass =
    mode === "light"
      ? `${styles.themeCard} ${styles.themeCardLight}`
      : `${styles.themeCard} ${styles.themeCardDark}`;
  return (
    <div className={cardClass}>
      <span className={styles.themeCardLabel}>{label}</span>
      <Grid columns="auto-fill" minColumnWidth="180px" gap={3}>
        {buildSwatches(theme).map((s) => (
          <Swatch
            key={`${mode}-${s.token}`}
            {...s}
            surface={surface}
            textColor={textColor}
          />
        ))}
      </Grid>
    </div>
  );
}

export function PaletteSection() {
  return (
    <SectionShell
      id="palette"
      index="01"
      eyebrow="Palette"
      title="Palette — paper, ink, rust, signal"
      lede="Two themes, one palette. Each swatch reports its WCAG AA contrast ratio against its theme's paper surface. A pill flagged rust means it fails 4.5:1 — by design for large display text only."
    >
      <Stack gap={6}>
        <ThemeGrid theme={palette.light} mode="light" />
        <ThemeGrid theme={palette.dark} mode="dark" />
        <Text variant="caption" tone="muted">
          Source: <code>packages/ui/src/tokens.ts → palette</code>. WCAG ratios
          computed from sRGB relative luminance. Pills pass at ≥ 4.5:1.
        </Text>
      </Stack>
    </SectionShell>
  );
}
