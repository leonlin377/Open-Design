import Link from "next/link";
import { Badge, Button, Surface } from "@opendesign/ui";
import { AuthPanel } from "../../components/auth-panel";
import { ThemeToggle } from "../../components/theme-toggle";
import { LocaleSwitcher } from "../../components/locale-switcher";
import { getSession, listArtifacts, listProjects } from "../../lib/opendesign-api";
import {
  createArtifactAction,
  createProjectAction,
  createProjectShareTokenAction
} from "./actions";
import { ProjectsPageClient } from "./projects-page-client";

const artifactKinds = ["website", "prototype", "slides"] as const;

export default async function ProjectsPage() {
  const [session, projects] = await Promise.all([getSession(), listProjects()]);
  const projectsWithArtifacts = await Promise.all(
    projects.map(async (project) => ({
      project,
      artifacts: await listArtifacts(project.id)
    }))
  );

  return (
    <ProjectsPageClient
      session={session}
      projectsWithArtifacts={projectsWithArtifacts}
    />
  );
}
