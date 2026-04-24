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

export async function quickStartAction(formData: FormData) {
  const prompt = String(formData.get("prompt") ?? "").trim();
  const kind = (String(formData.get("kind") ?? "website").trim() as
    | "website"
    | "prototype"
    | "slides");

  if (!prompt) {
    throw new Error("Prompt is required.");
  }

  const projectName =
    prompt
      .slice(0, 40)
      .replace(/[^\w\s一-鿿]/g, "")
      .trim() || "Quick Project";

  const project = await createProject({ name: projectName });
  const artifact = await createArtifact({
    projectId: project.id,
    kind,
    name: `${projectName} ${kind[0].toUpperCase()}${kind.slice(1)}`
  });

  revalidatePath("/projects");
  redirect(
    `/studio/${project.id}/${artifact.id}?quickPrompt=${encodeURIComponent(prompt)}`
  );
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
