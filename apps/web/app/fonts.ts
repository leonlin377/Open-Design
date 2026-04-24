/**
 * Centralised font configuration for the web app.
 *
 * Identity (BRAND-001, 2026-04-20). Three faces:
 *   - Instrument Serif — display only: h1, artifact titles, hero copy.
 *   - Inter (400/500/600) — UI and body text.
 *   - JetBrains Mono — code, timestamps, version numbers.
 *
 * - `fontSans`    -> Inter, bound to `--od-font-sans`.
 * - `fontMono`    -> JetBrains Mono, bound to `--od-font-mono`.
 * - `fontDisplay` -> Instrument Serif, bound to `--od-font-display`.
 *
 * Import `{ fontSans, fontMono, fontDisplay }` in `layout.tsx` to wire the
 * className onto `<html>`.
 */

import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";

export const fontSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--od-font-sans",
  display: "swap"
});

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--od-font-mono",
  display: "swap"
});

// Instrument Serif ships a single weight (400), used exclusively for display
// copy (h1 / artifact titles / marketing hero). Do NOT use for UI labels.
export const fontDisplay = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--od-font-display",
  display: "swap"
});

export const fontClassNames = [
  fontSans.variable,
  fontMono.variable,
  fontDisplay.variable
].join(" ");
