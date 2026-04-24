"use client";

import * as React from "react";
import { Heading } from "@opendesign/ui";
import styles from "../styleguide.module.css";

export type SectionShellProps = {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Shared section chrome: mono-label numbered eyebrow, display-weight title
 * with a copyable `#` anchor, and an optional lede line. Everything below
 * stacks into the `.section` grid.
 */
export function SectionShell({
  id,
  index,
  eyebrow,
  title,
  lede,
  children
}: SectionShellProps) {
  return (
    <section id={id} className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionEyebrow}>
          <span className="idx">§ {index}</span>
          <span>{eyebrow}</span>
        </span>
        <a href={`#${id}`} className={styles.anchorTitle}>
          <Heading level={2} variant="title-l">
            {title}
          </Heading>
          <span className="hash" aria-hidden>
            #
          </span>
        </a>
        {lede ? (
          <span style={{ color: "var(--ink-2)", fontSize: 15, lineHeight: 1.55 }}>
            {lede}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
