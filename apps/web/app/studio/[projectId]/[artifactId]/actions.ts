"use server";

import { revalidatePath } from "next/cache";
import {
  appendSceneTemplate,
  createArtifactComment,
  createArtifactVersion,
  resolveArtifactComment,
  updateSceneNode
} from "../../../../lib/opendesign-api";

function getStudioPath(projectId: string, artifactId: string) {
  return `/studio/${projectId}/${artifactId}`;
}

export async function createArtifactVersionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();

  if (!projectId || !artifactId || !label) {
    throw new Error("Project, artifact, and version label are required.");
  }

  await createArtifactVersion({
    projectId,
    artifactId,
    label,
    summary: summary || undefined
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}

export async function createArtifactCommentAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!projectId || !artifactId || !body) {
    throw new Error("Project, artifact, and comment body are required.");
  }

  await createArtifactComment({
    projectId,
    artifactId,
    body
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}

export async function resolveArtifactCommentAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const commentId = String(formData.get("commentId") ?? "").trim();

  if (!projectId || !artifactId || !commentId) {
    throw new Error("Project, artifact, and comment are required.");
  }

  await resolveArtifactComment({
    projectId,
    artifactId,
    commentId
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}

export async function appendSceneTemplateAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim() as
    | "hero"
    | "feature-grid"
    | "cta";

  if (!projectId || !artifactId || !template) {
    throw new Error("Project, artifact, and scene template are required.");
  }

  await appendSceneTemplate({
    projectId,
    artifactId,
    template
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}

export async function updateSceneNodeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const nodeId = String(formData.get("nodeId") ?? "").trim();

  if (!projectId || !artifactId || !nodeId) {
    throw new Error("Project, artifact, and scene node are required.");
  }

  await updateSceneNode({
    projectId,
    artifactId,
    nodeId,
    name: String(formData.get("name") ?? "").trim() || undefined,
    eyebrow: String(formData.get("eyebrow") ?? "").trim() || undefined,
    headline: String(formData.get("headline") ?? "").trim() || undefined,
    body: String(formData.get("body") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? "").trim() || undefined,
    primaryAction: String(formData.get("primaryAction") ?? "").trim() || undefined,
    secondaryAction: String(formData.get("secondaryAction") ?? "").trim() || undefined
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}
