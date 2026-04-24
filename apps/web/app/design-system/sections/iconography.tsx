"use client";

import * as React from "react";
import { Grid, Inline, Stack, Text } from "@opendesign/ui";
import { icons } from "../../../../../packages/ui/src/tokens";
import { SectionShell } from "./section";
import styles from "../styleguide.module.css";

type IconGlyph = (props: { size: number }) => React.ReactElement;

const GLYPHS: ReadonlyArray<{
  readonly name: string;
  readonly render: IconGlyph;
}> = [
  {
    name: "search",
    render: ({ size }) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={icons.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20L16 16" />
      </svg>
    )
  },
  {
    name: "plus",
    render: ({ size }) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={icons.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 5V19M5 12H19" />
      </svg>
    )
  },
  {
    name: "check",
    render: ({ size }) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={icons.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 12.5L9.5 18L20 7" />
      </svg>
    )
  },
  {
    name: "arrow-right",
    render: ({ size }) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={icons.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12H19M13 6L19 12L13 18" />
      </svg>
    )
  },
  {
    name: "settings",
    render: ({ size }) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={icons.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15A1.65 1.65 0 0 0 19.8 13.2L20.9 12L19.8 10.8A1.65 1.65 0 0 0 19.4 9L20 7L18 6L16.5 6.9A1.65 1.65 0 0 0 15 6.4L14.2 4.2H9.8L9 6.4A1.65 1.65 0 0 0 7.5 6.9L6 6L4 7L4.6 9A1.65 1.65 0 0 0 4.2 10.8L3.1 12L4.2 13.2A1.65 1.65 0 0 0 4.6 15L4 17L6 18L7.5 17.1A1.65 1.65 0 0 0 9 17.6L9.8 19.8H14.2L15 17.6A1.65 1.65 0 0 0 16.5 17.1L18 18L20 17L19.4 15Z" />
      </svg>
    )
  }
];

export function IconographySection() {
  return (
    <SectionShell
      id="iconography"
      index="11"
      eyebrow="Iconography"
      title={`Icons — ${icons.sizes.join(" / ")} · stroke ${icons.strokeWidth}`}
      lede="Outline style, currentColor, 1.5px stroke, square caps rounded. Scale to the nearest named size — no 17px."
    >
      <Stack gap={4}>
        {icons.sizes.map((size) => (
          <Stack key={size} gap={3}>
            <Text variant="mono-label" tone="muted">
              size · {size}
            </Text>
            <Inline gap={3} wrap>
              {GLYPHS.map((glyph) => (
                <div key={`${size}-${glyph.name}`} className={styles.iconCell}>
                  {glyph.render({ size })}
                  <span className={styles.iconCellLabel}>{glyph.name}</span>
                </div>
              ))}
            </Inline>
          </Stack>
        ))}
      </Stack>
    </SectionShell>
  );
}
