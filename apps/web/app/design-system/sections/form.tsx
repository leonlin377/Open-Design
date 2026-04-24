"use client";

import * as React from "react";
import {
  Checkbox,
  FormField,
  Grid,
  Input,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  Text,
  Textarea
} from "@opendesign/ui";
import { SectionShell } from "./section";

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M13.5 13.5L10.5 10.5" />
    </svg>
  );
}

export function FormSection() {
  const [name, setName] = React.useState("");
  const [bio, setBio] = React.useState("");
  return (
    <SectionShell
      id="form"
      index="04"
      eyebrow="Form"
      title="Form primitives — Input / Textarea / Select / Check / Radio / Switch"
      lede="All inputs share the same focus ring (rust 2px), the same 40px medium height, and the same FormField wrapper for label + help + error wiring."
    >
      <Grid columns={2} gap={6}>
        <Stack gap={4}>
          <FormField
            label="Full name"
            help="Displayed on your profile and shared artifacts."
            required
            htmlFor="ds-name"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              clearable
              onClear={() => setName("")}
            />
          </FormField>

          <FormField
            label="Search library"
            help="⌘K from anywhere on the page."
            htmlFor="ds-search"
          >
            <Input leading={<SearchIcon />} placeholder="Search primitives…" />
          </FormField>

          <FormField
            label="Email"
            error="That address is already in use."
            htmlFor="ds-email"
          >
            <Input defaultValue="ada@analytical.engine" />
          </FormField>

          <FormField label="API token" help="Cannot be changed after issue." htmlFor="ds-token">
            <Input defaultValue="sk-•••••••••••••••••" disabled />
          </FormField>

          <FormField label="Bio" help="Up to 200 characters." htmlFor="ds-bio">
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A brief introduction…"
              autoGrow
            />
          </FormField>
        </Stack>

        <Stack gap={4}>
          <FormField label="Artifact type" htmlFor="ds-type">
            <Select
              defaultValue=""
              placeholder="Choose a type"
              options={[
                { value: "website", label: "Website" },
                { value: "prototype", label: "Prototype" },
                { value: "slides", label: "Slides" }
              ]}
            />
          </FormField>

          <FormField
            label="Theme"
            help="System follows your OS preference."
          >
            <RadioGroup name="ds-theme" defaultValue="system">
              <Radio value="system" label="System" />
              <Radio value="light" label="Light" />
              <Radio value="dark" label="Dark" />
            </RadioGroup>
          </FormField>

          <FormField label="Plan features">
            <Stack gap={2}>
              <Checkbox
                defaultChecked
                label="Artifact versioning"
                description="Keep every scene revision."
              />
              <Checkbox
                indeterminate
                label="AI refinement"
                description="Partially enabled across scenes."
              />
              <Checkbox
                disabled
                label="Enterprise SSO"
                description="Contact sales."
              />
            </Stack>
          </FormField>

          <FormField label="Runtime">
            <Stack gap={2}>
              <Switch defaultChecked label="Realtime collaboration" />
              <Switch label="Motion (respects prefers-reduced-motion)" />
              <Switch disabled label="Experimental: auto-commit" />
            </Stack>
          </FormField>

          <Text variant="caption" tone="muted">
            Error states derive <code>aria-invalid</code> + <code>aria-errormessage</code>
            automatically from the FormField wrapper.
          </Text>
        </Stack>
      </Grid>
    </SectionShell>
  );
}
