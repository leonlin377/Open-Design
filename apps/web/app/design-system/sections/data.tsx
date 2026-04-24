"use client";

import * as React from "react";
import {
  Avatar,
  Grid,
  Inline,
  KeyValue,
  Skeleton,
  Stack,
  Surface,
  Text
} from "@opendesign/ui";
import { SectionShell } from "./section";

const KV_ITEMS = [
  { label: "Version", value: "0.1.0" },
  { label: "Updated", value: "2026-04-20 14:02 UTC" },
  { label: "Artifact type", value: "Website" },
  { label: "Scene version", value: "42" },
  { label: "Design system", value: "OpenDesign · Claude warm paper" },
  { label: "Comments", value: "3 open · 12 resolved" }
] as const;

export function DataSection() {
  return (
    <SectionShell
      id="data"
      index="08"
      eyebrow="Data"
      title="KeyValue · Avatar · Skeleton"
      lede="Information components for dense, metadata-heavy surfaces. KeyValue is a real <dl>; Avatar gracefully falls back to initials."
    >
      <Grid columns={2} gap={6}>
        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            KeyValue · layout beside
          </Text>
          <Surface tone="panel" padding="lg">
            <KeyValue items={KV_ITEMS} />
          </Surface>
        </Stack>

        <Stack gap={6}>
          <Stack gap={3}>
            <Text variant="mono-label" tone="muted">
              Avatar — sm · md · lg, plus fallback
            </Text>
            <Inline gap={4} align="center">
              <Avatar size="sm" name="Ada Lovelace" />
              <Avatar size="md" name="Ada Lovelace" />
              <Avatar size="lg" name="Ada Lovelace" />
              <Avatar size="md" initials="?" alt="Unknown user" />
            </Inline>
          </Stack>

          <Stack gap={3}>
            <Text variant="mono-label" tone="muted">
              Skeleton · card placeholder
            </Text>
            <Surface tone="panel" padding="lg">
              <Stack gap={3}>
                <Inline gap={3} align="center">
                  <Skeleton shape="circle" width={40} height={40} />
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Skeleton shape="text" width="40%" />
                    <Skeleton shape="text" width="70%" />
                  </Stack>
                </Inline>
                <Skeleton shape="rect" height={140} />
                <Skeleton shape="text" lines={3} />
              </Stack>
            </Surface>
          </Stack>
        </Stack>
      </Grid>
    </SectionShell>
  );
}
