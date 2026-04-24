"use client";

import * as React from "react";
import {
  Breadcrumb,
  Stack,
  Steps,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTrigger,
  Text
} from "@opendesign/ui";
import { SectionShell } from "./section";

const PROGRESS: ReadonlyArray<{
  readonly title: string;
  readonly description?: string;
}> = [
  { title: "Brief", description: "Capture intent" },
  { title: "Scaffold", description: "Generate scenes" },
  { title: "Refine", description: "Iterate copy & visuals" },
  { title: "Export", description: "Ship or remix" }
];

export function NavSection() {
  return (
    <SectionShell
      id="navigation"
      index="05"
      eyebrow="Navigation"
      title="Tabs · Breadcrumb · Steps"
      lede="All three share the same rust accent rail / mono-label typography. Tabs keyboard: ← → jumps, Home/End snaps to edges."
    >
      <Stack gap={6}>
        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Tabs
          </Text>
          <Tabs defaultValue="preview">
            <TabsList aria-label="Artifact view">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsPanel value="preview">
              <Text variant="body" tone="secondary">
                Live artifact preview. Switches in place without remounting.
              </Text>
            </TabsPanel>
            <TabsPanel value="code">
              <Text variant="body" tone="secondary">
                Generated source. Read-only, copyable via Kbd shortcut.
              </Text>
            </TabsPanel>
            <TabsPanel value="history">
              <Text variant="body" tone="secondary">
                Scene-version timeline with restore points.
              </Text>
            </TabsPanel>
          </Tabs>
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Breadcrumb
          </Text>
          <Breadcrumb
            items={[
              { label: "OpenDesign", href: "/" },
              { label: "Projects", href: "/projects" },
              { label: "Landing Refresh", current: true }
            ]}
          />
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Steps · horizontal
          </Text>
          <Steps steps={PROGRESS} current={1} orientation="horizontal" />
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Steps · vertical
          </Text>
          <Steps steps={PROGRESS} current={2} orientation="vertical" />
        </Stack>
      </Stack>
    </SectionShell>
  );
}
