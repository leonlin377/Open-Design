"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import {
  createArtifact,
  createProject,
  createProjectShareToken
} from "../../lib/opendesign-api";

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Project name is required.");
  }

  await createProject({ name });
  revalidatePath("/projects");
}

export async function createArtifactAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim() as
    | "website"
    | "prototype"
    | "slides";

  if (!projectId || !projectName || !kind) {
    throw new Error("Project and artifact kind are required.");
  }

  const artifact = await createArtifact({
    projectId,
    kind,
    name: `${projectName} ${kind[0].toUpperCase()}${kind.slice(1)}`
  });

  revalidatePath("/projects");
  redirect(`/studio/${projectId}/${artifact.id}`);
}

export async function createProjectShareTokenAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const role = String(formData.get("role") ?? "viewer").trim() as
    | "viewer"
    | "commenter"
    | "editor";

  if (!projectId) {
    throw new Error("Project is required.");
  }

  const shareResponse = await createProjectShareToken({
    projectId,
    role
  });
  redirect(shareResponse.sharePath as Route);
}
