"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  FormField,
  Inline,
  Input,
  Popover,
  Stack,
  Text,
  Tooltip
} from "@opendesign/ui";
import { SectionShell } from "./section";

function InfoGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 11V7.5M8 5.25v.01" />
    </svg>
  );
}

export function OverlaySection() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [name, setName] = React.useState("Landing refresh");
  const popoverAnchor = React.useRef<HTMLSpanElement | null>(null);

  return (
    <SectionShell
      id="overlay"
      index="06"
      eyebrow="Overlay"
      title="Dialog · Popover · Tooltip"
      lede="Dialog uses native <dialog> with manual Tab trap. Popover computes anchor rect on open + resize. Tooltip is CSS-only with a 500ms delay."
    >
      <Inline gap={4} wrap align="center">
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          Open dialog
        </Button>

        <span ref={popoverAnchor} style={{ display: "inline-flex" }}>
          <Button
            variant="secondary"
            onClick={() => setPopoverOpen((o) => !o)}
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
          >
            Toggle popover
          </Button>
        </span>
        <Popover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          anchor={popoverAnchor}
          placement="bottom-start"
          ariaLabel="Quick settings"
        >
          <Stack gap={3} style={{ padding: 4, width: 240 }}>
            <Text variant="mono-label" tone="muted">
              Quick settings
            </Text>
            <Text variant="body-s" tone="secondary">
              Anchored to the button that opened it. Closes on outside click
              or Escape.
            </Text>
            <Button variant="outline" size="sm" onClick={() => setPopoverOpen(false)}>
              Close
            </Button>
          </Stack>
        </Popover>

        <Tooltip label="Opens the artifact metadata panel">
          <button
            type="button"
            aria-label="Info"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--hairline)",
              background: "var(--paper-raised)",
              color: "var(--ink-2)",
              cursor: "pointer"
            }}
          >
            <InfoGlyph />
          </button>
        </Tooltip>
      </Inline>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Rename artifact"
        description="Names appear in breadcrumbs and export filenames."
        footer={
          <Inline gap={3} justify="end">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Save
            </Button>
          </Inline>
        }
      >
        <Stack gap={3}>
          <FormField label="Artifact name" htmlFor="ds-dialog-name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Landing refresh"
            />
          </FormField>
        </Stack>
      </Dialog>
    </SectionShell>
  );
}
