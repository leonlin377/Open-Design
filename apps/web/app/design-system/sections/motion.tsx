"use client";

import * as React from "react";
import { Button, Stack, Text } from "@opendesign/ui";
import {
  motion as motionTokens,
  type MotionName
} from "../../../../../packages/ui/src/tokens";
import { SectionShell } from "./section";
import styles from "../styleguide.module.css";

const MOTION_NAMES = [
  "quick",
  "base",
  "enter",
  "exit",
  "spring",
  "indicator",
  "blink",
  "reduce"
] as const satisfies readonly MotionName[];

function MotionRow({ name }: { name: MotionName }) {
  const token = motionTokens[name];
  const [active, setActive] = React.useState(false);

  const transform = active ? "translateX(40px)" : "translateX(0)";
  const transition = `transform ${token.duration}ms ${token.easing}`;

  return (
    <div className={styles.motionRow}>
      <span className={styles.typeMeta}>{name}</span>
      <div className={styles.motionTrack}>
        <span
          className={styles.motionBlock}
          style={{ transform, transition }}
          data-active={active ? "true" : "false"}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "flex-end"
        }}
      >
        <span className={styles.typeStats}>
          {token.duration}ms · {token.easing.replace("cubic-bezier", "cb")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActive((a) => !a)}
        >
          {active ? "Reset" : "Run"}
        </Button>
      </div>
    </div>
  );
}

export function MotionSection() {
  return (
    <SectionShell
      id="motion"
      index="10"
      eyebrow="Motion"
      title="Motion tokens — 8 named durations × easings"
      lede="Spring is the only curve with overshoot; everything else is ease-out. `reduce` collapses to 1ms for users with prefers-reduced-motion."
    >
      <Stack gap={0}>
        {MOTION_NAMES.map((name) => (
          <MotionRow key={name} name={name} />
        ))}
      </Stack>
      <Text variant="caption" tone="muted">
        Source: <code>packages/ui/src/tokens.ts → motion</code>.
      </Text>
    </SectionShell>
  );
}
