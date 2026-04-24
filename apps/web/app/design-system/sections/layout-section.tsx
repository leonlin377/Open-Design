"use client";

import * as React from "react";
import {
  Container,
  Divider,
  Grid,
  Inline,
  Stack,
  Surface,
  Text
} from "@opendesign/ui";
import { SectionShell } from "./section";
import styles from "../styleguide.module.css";

function Block({ label }: { label: string }) {
  return (
    <Surface tone="muted" padding="sm">
      <Text variant="mono-label" tone="muted">
        {label}
      </Text>
    </Surface>
  );
}

export function LayoutSection() {
  return (
    <SectionShell
      id="layout"
      index="09"
      eyebrow="Layout"
      title="Stack · Inline · Grid · Container"
      lede="Four layout primitives cover 95% of composition. Guides (dashed outlines) are on here for legibility; never in production."
    >
      <Grid columns={2} gap={6}>
        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Stack · vertical gap=4 (16px)
          </Text>
          <div className={`${styles.demoSurface} ${styles.demoGuide}`}>
            <Stack gap={4}>
              <Block label="A" />
              <Block label="B" />
              <Block label="C" />
            </Stack>
          </div>
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Inline · horizontal gap=3 (12px)
          </Text>
          <div className={`${styles.demoSurface} ${styles.demoGuide}`}>
            <Inline gap={3} wrap>
              <Block label="Tag-A" />
              <Block label="Tag-B" />
              <Block label="Tag-C" />
              <Block label="Tag-D" />
            </Inline>
          </div>
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Grid · 3 columns, gap=3
          </Text>
          <div className={`${styles.demoSurface} ${styles.demoGuide}`}>
            <Grid columns={3} gap={3}>
              <Block label="01" />
              <Block label="02" />
              <Block label="03" />
              <Block label="04" />
              <Block label="05" />
              <Block label="06" />
            </Grid>
          </div>
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Container · width=md, padded
          </Text>
          <div className={styles.demoSurface}>
            <Container width="md" padded>
              <Stack gap={3}>
                <Text variant="title-s">Centered content</Text>
                <Divider />
                <Text variant="body-s" tone="secondary">
                  Container caps the reading measure at 768px and pads the inline
                  axis using --space-6 (24px).
                </Text>
              </Stack>
            </Container>
          </div>
        </Stack>
      </Grid>

      <Divider label="Dividers can carry a label" />
    </SectionShell>
  );
}
