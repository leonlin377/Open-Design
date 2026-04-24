"use client";

import * as React from "react";
import { ToastProvider } from "@opendesign/ui";
import { OverviewSection } from "./sections/overview";
import { PaletteSection } from "./sections/palette";
import { TypographySection } from "./sections/typography";
import { ButtonsSection } from "./sections/buttons";
import { FormSection } from "./sections/form";
import { NavSection } from "./sections/nav";
import { OverlaySection } from "./sections/overlay";
import { FeedbackSection } from "./sections/feedback";
import { DataSection } from "./sections/data";
import { LayoutSection } from "./sections/layout-section";
import { MotionSection } from "./sections/motion";
import { IconographySection } from "./sections/iconography";
import styles from "./styleguide.module.css";

/**
 * Developer-facing style guide. Intentionally a single client route so
 * interactive demos (popover, dialog, toast, motion triggers) compose
 * naturally. ToastProvider is scoped to this route to avoid leaking a
 * viewport into the studio / landing shells.
 */

type NavEntry = {
  readonly id: string;
  readonly index: string;
  readonly label: string;
};

const NAV: readonly NavEntry[] = [
  { id: "overview", index: "00", label: "Overview" },
  { id: "palette", index: "01", label: "Palette" },
  { id: "typography", index: "02", label: "Typography" },
  { id: "buttons", index: "03", label: "Buttons" },
  { id: "form", index: "04", label: "Form" },
  { id: "navigation", index: "05", label: "Navigation" },
  { id: "overlay", index: "06", label: "Overlay" },
  { id: "feedback", index: "07", label: "Feedback" },
  { id: "data", index: "08", label: "Data" },
  { id: "layout", index: "09", label: "Layout" },
  { id: "motion", index: "10", label: "Motion" },
  { id: "iconography", index: "11", label: "Iconography" }
];

export default function DesignSystemPage() {
  return (
    <ToastProvider>
      <div className={styles.colophon}>
        <span className="liveRow" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className={styles.liveDot} aria-hidden />
          <span>OpenDesign · Styleguide · 2026</span>
        </span>
        <span>last verified 2026-04-20</span>
      </div>

      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="Styleguide sections">
          <ul className={styles.navList}>
            {NAV.map((entry) => (
              <li key={entry.id} className={styles.navItem}>
                <a className={styles.navLink} href={`#${entry.id}`}>
                  <span className={styles.navIndex}>§ {entry.index}</span>
                  <span>{entry.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className={styles.body}>
          <OverviewSection />
          <PaletteSection />
          <TypographySection />
          <ButtonsSection />
          <FormSection />
          <NavSection />
          <OverlaySection />
          <FeedbackSection />
          <DataSection />
          <LayoutSection />
          <MotionSection />
          <IconographySection />
        </main>
      </div>

      <footer className={styles.pageFooter}>
        <span>version 0.1.0 · styleguide</span>
        <span className="footnote">
          Warm paper calibrated against Claude Design · craft detail after Rauno
          Freiberg · motion primitives after Emil Kowalski
        </span>
      </footer>
    </ToastProvider>
  );
}
