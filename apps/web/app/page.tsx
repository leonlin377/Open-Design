"use client";

import Link from "next/link";
import {
  Chip,
  Container,
  Grid,
  Heading,
  Inline,
  Stack,
  Surface,
  Text
} from "@opendesign/ui";
import { ThemeToggle } from "../components/theme-toggle";
import { LocaleSwitcher } from "../components/locale-switcher";
import { QuickStartComposer } from "../components/quick-start-composer";
import { useT } from "../lib/i18n";

export default function HomePage() {
  const t = useT();

  return (
    <Container width="lg" as="main" className="page" id="main-content">
      <header className="page-colophon">
        <div className="page-colophon-left">
          <span className="live-dot" aria-hidden />
          <span className="mono-caption">OpenDesign · 2026</span>
        </div>
        <Inline gap={3} className="page-colophon-right">
          <LocaleSwitcher />
          <ThemeToggle />
        </Inline>
      </header>

      <section className="hero hero-asymmetric">
        <span className="mono-label">
          <span className="mono-index">00</span>
          <span>{t("landing.badge")}</span>
        </span>
        <Heading level={1} variant="display" className="hero-headline">
          {t("landing.heading.main")}
          <span className="cursor-pulse" aria-hidden />
        </Heading>
        <Text variant="body-l" tone="secondary" className="hero-lede">
          {t("landing.description")}
        </Text>
        <QuickStartComposer />
      </section>

      <section className="craft-strip">
        <span className="mono-label">
          <span className="mono-index">01</span>
          <span>{t("landing.launch.badge")}</span>
        </span>
        <Text variant="body-l" className="craft-strip-lead">
          {t("landing.launch.title")}
        </Text>
        <ol className="craft-steps">
          {[
            t("landing.launch.step1"),
            t("landing.launch.step2"),
            t("landing.launch.step3")
          ].map((step, index) => (
            <li key={index} className="craft-step">
              <span className="craft-step-index">{String(index + 1).padStart(2, "0")}</span>
              <Text as="p" variant="body">{step}</Text>
            </li>
          ))}
        </ol>
      </section>

      <section className="craft-strip">
        <Inline gap={3} wrap align="center" justify="space-between">
          <span className="mono-label">
            <span className="mono-index">02</span>
            <span>{t("landing.section.artifacts")}</span>
          </span>
          <Inline gap={2} wrap>
            <Chip tone="outline">{t("landing.artifact.website.title")}</Chip>
            <Chip tone="outline">{t("landing.artifact.prototype.title")}</Chip>
            <Chip tone="outline">{t("landing.artifact.slides.title")}</Chip>
          </Inline>
        </Inline>
        <Grid
          columns="auto-fill"
          minColumnWidth="260px"
          gap={6}
          className="feature-grid"
        >
          {[
            {
              k: "01",
              title: t("landing.artifact.website.title"),
              body: t("landing.artifact.website.desc")
            },
            {
              k: "02",
              title: t("landing.artifact.prototype.title"),
              body: t("landing.artifact.prototype.desc")
            },
            {
              k: "03",
              title: t("landing.artifact.slides.title"),
              body: t("landing.artifact.slides.desc")
            }
          ].map((track) => (
            <Surface key={track.k} as="article" className="feature-card">
              <span className="feature-card-index">{track.k}</span>
              <Heading level={3} variant="title-m">{track.title}</Heading>
              <Text as="p" variant="body" tone="secondary">{track.body}</Text>
              <Link href="/projects" className="feature-card-link">
                <span>{t("landing.button.studio")}</span>
                <span className="feature-card-link-arrow" aria-hidden>→</span>
              </Link>
            </Surface>
          ))}
        </Grid>
      </section>

      <footer className="page-footer">
        <Stack gap={2}>
          <span className="mono-caption">version 0.1.0 · updated 2026-04-20</span>
          <span className="mono-caption footnote">
            An artifact-first workspace for teams shipping visual systems. Warm paper,
            moss accent, editorial typography, calm motion. Built in the open.
          </span>
        </Stack>
      </footer>
    </Container>
  );
}
