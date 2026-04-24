"use client";

import * as React from "react";
import { Stack, Text, type TextVariant } from "@opendesign/ui";
import {
  typeScale,
  type TypeScaleName
} from "../../../../../packages/ui/src/tokens";
import { SectionShell } from "./section";
import styles from "../styleguide.module.css";

/**
 * Maps the TypeScale key set (camelCase) to the Text primitive's variant
 * strings (kebab-case). The `satisfies` pins each entry to a legal variant
 * so adding a new type scale breaks this table at compile time.
 */
const TYPE_ROWS = [
  { name: "display", variant: "display", sample: "系统的形态。Form of the system." },
  { name: "titleL", variant: "title-l", sample: "系统的形态。Form of the system." },
  { name: "titleM", variant: "title-m", sample: "An artifact-first workspace." },
  { name: "titleS", variant: "title-s", sample: "An artifact-first workspace." },
  { name: "bodyL", variant: "body-l", sample: "Large body copy introduces a dense section of prose with a calmer reading rhythm." },
  { name: "body", variant: "body", sample: "Body copy. The default reading rhythm across dialogs, forms, and long descriptions." },
  { name: "bodyS", variant: "body-s", sample: "Body-small. Used for secondary captions, table cells, and metadata beneath a headline." },
  { name: "label", variant: "label", sample: "Field label" },
  { name: "caption", variant: "caption", sample: "Caption · supporting metadata" },
  { name: "monoLabel", variant: "mono-label", sample: "Mono label · section marker" },
  { name: "data", variant: "data", sample: "v0.1.0 · 2026-04-20 · 142,384" }
] as const satisfies ReadonlyArray<{
  readonly name: TypeScaleName;
  readonly variant: TextVariant;
  readonly sample: string;
}>;

export function TypographySection() {
  return (
    <SectionShell
      id="typography"
      index="02"
      eyebrow="Typography"
      title="Type scale — Instrument Serif + Inter + JetBrains Mono"
      lede={
        <>
          Eleven named type tokens, three families. Display + title tokens use
          Instrument Serif so CJK falls back to Source Han Serif. Body is Inter;
          mono is JetBrains Mono. Serif italics carry soft emphasis inside body:{" "}
          <em style={{ fontFamily: "var(--font-display, Georgia), serif" }}>
            a workspace for visual systems
          </em>
          .
        </>
      }
    >
      <Stack gap={0}>
        {TYPE_ROWS.map((row) => {
          const token = typeScale[row.name];
          return (
            <div key={row.name} className={styles.typeRow}>
              <span className={styles.typeMeta}>{row.variant}</span>
              <Text as="span" variant={row.variant} tone="primary">
                {row.sample}
              </Text>
              <span className={styles.typeStats}>
                {token.fontSize} · lh {token.lineHeight} · ls{" "}
                {token.letterSpacing}
              </span>
            </div>
          );
        })}
      </Stack>
    </SectionShell>
  );
}
