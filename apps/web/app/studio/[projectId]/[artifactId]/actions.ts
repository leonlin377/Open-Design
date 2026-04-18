"use server";

import { revalidatePath } from "next/cache";
import {
  createArtifactComment,
  createArtifactVersion,
  resolveArtifactComment
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
