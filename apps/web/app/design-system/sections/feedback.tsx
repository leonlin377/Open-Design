"use client";

import * as React from "react";
import {
  Alert,
  Button,
  EmptyState,
  Inline,
  Stack,
  Steps,
  Text,
  useToast,
  type AlertProps,
  type ToastTone
} from "@opendesign/ui";
import { SectionShell } from "./section";
import styles from "../styleguide.module.css";

type AlertTone = NonNullable<AlertProps["tone"]>;
const ALERT_TONES = [
  "info",
  "success",
  "warn",
  "danger"
] as const satisfies readonly AlertTone[];

const TOAST_TONES = [
  "info",
  "success",
  "warn",
  "danger"
] as const satisfies readonly ToastTone[];

const ALERT_COPY: Readonly<Record<AlertTone, { title: string; body: string }>> = {
  info: {
    title: "Heads up",
    body: "Scene versions older than 30 days are archived automatically."
  },
  success: {
    title: "Saved",
    body: "Artifact version committed. Remix link copied to your clipboard."
  },
  warn: {
    title: "Almost at the cap",
    body: "You have 2 exports remaining on the free tier this month."
  },
  danger: {
    title: "Export failed",
    body: "The exporter could not reach the asset bucket. Retry in a moment."
  }
};

const EMPTY_STEPS = [
  { title: "Start a brief" },
  { title: "Generate a scaffold" },
  { title: "Refine and ship" }
] as const;

function ToastDemos() {
  const { push } = useToast();
  return (
    <div className={styles.toastRow}>
      {TOAST_TONES.map((tone) => (
        <Button
          key={tone}
          variant="outline"
          size="sm"
          onClick={() =>
            push({
              tone,
              title: `${tone[0].toUpperCase()}${tone.slice(1)} toast`,
              description: `This is a ${tone} notification. It auto-dismisses in 4s.`
            })
          }
        >
          Fire {tone}
        </Button>
      ))}
    </div>
  );
}

export function FeedbackSection() {
  return (
    <SectionShell
      id="feedback"
      index="07"
      eyebrow="Feedback"
      title="EmptyState · Alert · Toast"
      lede="Toasts stack at bottom-right via ToastProvider (mounted for this route only)."
    >
      <Stack gap={6}>
        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            EmptyState
          </Text>
          <EmptyState
            title="No artifacts yet"
            body={
              <Stack gap={4} align="center">
                <span>
                  Create a brief to scaffold your first scene. It takes about a
                  minute.
                </span>
                <Steps
                  steps={EMPTY_STEPS}
                  current={0}
                  orientation="horizontal"
                />
              </Stack>
            }
            action={
              <Inline gap={3} justify="center">
                <Button variant="primary">
                  Start a brief{" "}
                  <span className="button-arrow" aria-hidden>
                    →
                  </span>
                </Button>
                <Button variant="ghost">Import</Button>
              </Inline>
            }
          />
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Alert tones
          </Text>
          <Stack gap={3}>
            {ALERT_TONES.map((tone) => {
              const copy = ALERT_COPY[tone];
              return (
                <Alert key={tone} tone={tone} title={copy.title} onDismiss={() => {}}>
                  {copy.body}
                </Alert>
              );
            })}
          </Stack>
        </Stack>

        <Stack gap={3}>
          <Text variant="mono-label" tone="muted">
            Toast
          </Text>
          <ToastDemos />
        </Stack>
      </Stack>
    </SectionShell>
  );
}
