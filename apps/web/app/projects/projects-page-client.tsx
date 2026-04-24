"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Container,
  EmptyState,
  FormField,
  Heading,
  Inline,
  Input,
  KeyValue,
  Select,
  Stack,
  Surface,
  Text
} from "@opendesign/ui";
import { AuthPanel } from "../../components/auth-panel";
import { ThemeToggle } from "../../components/theme-toggle";
import { LocaleSwitcher } from "../../components/locale-switcher";
import { useT } from "../../lib/i18n";
import {
  createArtifactAction,
  createProjectAction,
  createProjectShareTokenAction
} from "./actions";
import type { ApiArtifact, ApiProject } from "../../lib/opendesign-api";

const artifactKinds = ["website", "prototype", "slides"] as const;

type ProjectsPageClientProps = {
  session: {
    session: {
      id: string;
    };
    user: {
      id: string;
      email?: string;
      name?: string | null;
    };
  } | null;
  projectsWithArtifacts: Array<{
    project: ApiProject;
    artifacts: ApiArtifact[];
  }>;
};

export function ProjectsPageClient({
  session,
  projectsWithArtifacts
}: ProjectsPageClientProps) {
  const t = useT();

  return (
    <Container width="lg" as="main" className="page">
      <section className="hero">
        <Inline justify="space-between" align="center" wrap className="hero-actions">
          <Badge tone={session ? "accent" : "outline"}>{t("projects.badge")}</Badge>
          <Inline gap={3}>
            <LocaleSwitcher />
            <ThemeToggle />
          </Inline>
        </Inline>
        <Heading level={1} variant="display">
          {session
            ? t("projects.heading.auth", {
                name: session.user.name || session.user.email || "your account"
              })
            : t("projects.heading.guest")}
        </Heading>
        <Text as="p" variant="body-l" tone="secondary">
          {session
            ? t("projects.description.auth")
            : t("projects.description.guest")}
        </Text>
        <Inline gap={3} className="hero-actions">
          <Link href="/" className="button-link ghost">
            {t("projects.button.back")}
          </Link>
        </Inline>
        <Surface className="onboarding-card" as="section">
          <Stack gap={4}>
            <Inline gap={3} align="center" className="onboarding-card-head">
              <Badge tone="outline">{t("projects.onboarding.badge")}</Badge>
              <Text as="strong" variant="title-s">
                {t("projects.onboarding.title")}
              </Text>
            </Inline>
            <div className="onboarding-steps">
              {[
                t("projects.onboarding.step1"),
                t("projects.onboarding.step2"),
                t("projects.onboarding.step3")
              ].map((step, index) => (
                <div key={index} className="onboarding-step">
                  <span>{index + 1}</span>
                  <Text as="p" variant="body-s">{step}</Text>
                </div>
              ))}
            </div>
          </Stack>
        </Surface>
      </section>

      <section className="projects-dashboard">
        <AuthPanel session={session} />
        <Surface className="project-card" as="section">
          <Stack gap={4}>
            <Stack gap={2}>
              <Heading level={3} variant="title-m">
                {t("projects.create.title")}
              </Heading>
              <Text as="p" variant="body-s" tone="muted" className="footer-note">
                {t("projects.create.description")}
              </Text>
            </Stack>
            <form action={createProjectAction} className="stack-form">
              <Stack gap={3}>
                <FormField label={t("projects.create.label")}>
                  <Input
                    name="name"
                    placeholder={t("projects.create.placeholder")}
                    required
                  />
                </FormField>
                <Button variant="primary" type="submit">
                  {t("projects.create.button")}
                </Button>
              </Stack>
            </form>
          </Stack>
        </Surface>
      </section>

      <Heading level={2} variant="title-l" className="section-title">
        {t("projects.section.active")}
      </Heading>
      <div className="projects-grid">
        {projectsWithArtifacts.length === 0 ? (
          <EmptyState
            title={t("projects.empty.title")}
            body={t("projects.empty.description")}
            action={
              <KeyValue
                layout="above"
                className="starter-grid"
                items={[
                  {
                    label: t("projects.empty.recommended.title"),
                    value: t("projects.empty.recommended.desc")
                  },
                  {
                    label: t("projects.empty.signedin.title"),
                    value: t("projects.empty.signedin.desc")
                  },
                  {
                    label: t("projects.empty.local.title"),
                    value: t("projects.empty.local.desc")
                  }
                ]}
              />
            }
          />
        ) : null}

        {projectsWithArtifacts.map(({ project, artifacts }) => (
          <Surface key={project.id} className="project-card" as="article">
            <Stack gap={4}>
              <Stack gap={2}>
                <Heading level={3} variant="title-m">
                  {project.name}
                </Heading>
                <Text as="p" variant="body-s" tone="muted" className="footer-note">
                  {project.ownerUserId
                    ? t("projects.card.owned")
                    : t("projects.card.local")}
                </Text>
              </Stack>
              <Inline gap={2} wrap className="project-meta">
                {artifacts.map((artifact) => (
                  <Badge key={artifact.id} tone="outline">
                    {artifact.kind}
                  </Badge>
                ))}
                {artifacts.length === 0 ? (
                  <Text as="span" variant="body-s" tone="muted">
                    {t("projects.artifacts.none")}
                  </Text>
                ) : null}
              </Inline>
              {artifacts.length === 0 ? (
                <KeyValue
                  layout="above"
                  items={[
                    {
                      label: t("projects.artifacts.first.title"),
                      value: t("projects.artifacts.first.desc")
                    }
                  ]}
                />
              ) : null}
              <Inline gap={3} wrap className="hero-actions">
                <form action={createProjectShareTokenAction}>
                  <Inline gap={2} align="center">
                    <input type="hidden" name="projectId" value={project.id} />
                    <Select
                      name="role"
                      defaultValue="viewer"
                      options={[
                        { value: "viewer", label: t("projects.share.viewer") },
                        { value: "commenter", label: t("projects.share.commenter") },
                        { value: "editor", label: t("projects.share.editor") }
                      ]}
                    />
                    <Button variant="outline" size="sm" type="submit">
                      {t("projects.share.button")}
                    </Button>
                  </Inline>
                </form>
                {artifacts.map((artifact) => (
                  <Link
                    key={artifact.id}
                    href={`/studio/${project.id}/${artifact.id}`}
                    className="button-link ghost"
                  >
                    {t("projects.button.open", { kind: artifact.kind })}
                  </Link>
                ))}
              </Inline>
              <Inline gap={2} wrap className="artifact-action-grid">
                {artifactKinds.map((kind) => (
                  <form key={kind} action={createArtifactAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="projectName" value={project.name} />
                    <input type="hidden" name="kind" value={kind} />
                    <Button variant="outline" size="sm" type="submit">
                      {t("projects.button.create", { kind })}
                    </Button>
                  </form>
                ))}
              </Inline>
            </Stack>
          </Surface>
        ))}
      </div>
    </Container>
  );
}
