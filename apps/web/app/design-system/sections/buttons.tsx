"use client";

import * as React from "react";
import { Button, Inline, Kbd, Stack, Text } from "@opendesign/ui";
import { SectionShell } from "./section";
import styles from "../styleguide.module.css";

type ButtonVariant = NonNullable<
  React.ComponentProps<typeof Button>["variant"]
>;
type ButtonSize = NonNullable<React.ComponentProps<typeof Button>["size"]>;

// Iterate via the component's own prop type so adding a new variant breaks
// this table at compile time.
const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "danger"
] as const satisfies readonly ButtonVariant[];

const BUTTON_SIZES = ["sm", "md", "lg"] as const satisfies readonly ButtonSize[];

export function ButtonsSection() {
  return (
    <SectionShell
      id="buttons"
      index="03"
      eyebrow="Buttons"
      title="Button — five variants × three sizes"
      lede="Flat by default. No gradient, no gloss, no lift. Hover = color only, active = 0.9 opacity. Focus = rust 2px ring via :focus-visible."
    >
      <Stack gap={6}>
        <div className={styles.buttonMatrix}>
          <span />
          {BUTTON_SIZES.map((size) => (
            <span key={size} className={styles.matrixHeader}>
              {size}
            </span>
          ))}
          {BUTTON_VARIANTS.map((variant) => (
            <React.Fragment key={variant}>
              <span className={styles.matrixHeader}>{variant}</span>
              {BUTTON_SIZES.map((size) => (
                <div key={`${variant}-${size}`}>
                  <Button variant={variant} size={size}>
                    Execute
                  </Button>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            States
          </Text>
          <Inline gap={3} wrap>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
            <Button variant="primary">
              Continue{" "}
              <span className="button-arrow" aria-hidden>
                →
              </span>
            </Button>
            <Button variant="outline">
              Learn more{" "}
              <span className="button-arrow" aria-hidden>
                →
              </span>
            </Button>
          </Inline>
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            With shortcut
          </Text>
          <Inline gap={3} align="center">
            <Button variant="primary">Submit</Button>
            <Text variant="body-s" tone="muted">
              <Kbd>⌘</Kbd> <Kbd>↵</Kbd>
            </Text>
          </Inline>
        </Stack>
      </Stack>
    </SectionShell>
  );
}
