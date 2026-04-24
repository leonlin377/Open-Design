"use client";

import * as React from "react";
import { Heading, Kbd, Stack, Text } from "@opendesign/ui";
import { SectionShell } from "./section";

/**
 * § Overview — display headline, live verification timestamp, manifesto, and
 * a Kbd-style link back to the canonical spec.
 */
export function OverviewSection() {
  return (
    <SectionShell
      id="overview"
      index="00"
      eyebrow="Overview"
      title="OpenDesign Design System · v0.1"
    >
      <Stack gap={4}>
        <Text variant="mono-label" tone="muted">
          last verified 2026-04-20 · CLAUDE-LOCK-001
        </Text>
        <Heading level={1} variant="display" tone="primary">
          An artifact-first workspace for <em>visual systems</em>.
        </Heading>
        <Text variant="body-l" tone="secondary">
          This page is the living anchor for the OpenDesign design language. It
          renders every token from <code>packages/ui/src/tokens.ts</code> and
          every primitive from <code>@opendesign/ui</code> so drift surfaces at a
          glance. Warm paper calibrated against Claude Design, craft after Rauno
          Freiberg, motion after Emil Kowalski.
        </Text>
        <Text variant="body" tone="muted">
          Canonical spec:{" "}
          <a
            href="/docs/design-system.md"
            style={{ textDecoration: "none", color: "var(--rust)" }}
          >
            <Kbd>docs/design-system.md</Kbd>
          </a>
          &nbsp;· Open inline docs with <Kbd>⌘</Kbd> <Kbd>K</Kbd>.
        </Text>
      </Stack>
    </SectionShell>
  );
}
