"use server";

import { revalidatePath } from "next/cache";
import {
  appendSceneTemplate,
  createArtifactComment,
  generateArtifact,
  createArtifactVersion,
  resolveArtifactComment,
  restoreArtifactVersion,
  saveArtifactCodeWorkspace,
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

export async function generateArtifactAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!projectId || !artifactId || !prompt) {
    throw new Error("Project, artifact, and prompt are required.");
  }

  await generateArtifact({
    projectId,
    artifactId,
    prompt
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
  const itemsTailJson = String(formData.get("itemsTailJson") ?? "").trim();
  const items = [0, 1, 2]
    .map((index) => ({
      label: String(formData.get(`item${index}Label`) ?? "").trim(),
      body: String(formData.get(`item${index}Body`) ?? "").trim()
    }))
    .filter((item) => item.label.length > 0 && item.body.length > 0);
  const itemsTail = itemsTailJson
    ? (() => {
        try {
          const parsed = JSON.parse(itemsTailJson) as unknown;

          if (!Array.isArray(parsed)) {
            return [];
          }

          return parsed.filter(
            (
              item
            ): item is {
              label: string;
              body: string;
            } =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as { label?: unknown }).label === "string" &&
              typeof (item as { body?: unknown }).body === "string"
          );
        } catch {
          return [];
        }
      })()
    : [];

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
    items: items.length > 0 || itemsTail.length > 0 ? [...items, ...itemsTail] : undefined,
    primaryAction: String(formData.get("primaryAction") ?? "").trim() || undefined,
    secondaryAction: String(formData.get("secondaryAction") ?? "").trim() || undefined
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}

export async function saveCodeWorkspaceAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const filesJson = String(formData.get("filesJson") ?? "").trim();

  if (!projectId || !artifactId || !filesJson) {
    throw new Error("Project, artifact, and code workspace files are required.");
  }

  let files: Record<string, string>;

  try {
    const parsed = JSON.parse(filesJson) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.values(parsed as Record<string, unknown>).some((value) => typeof value !== "string")
    ) {
      throw new Error("Invalid code workspace payload.");
    }

    files = parsed as Record<string, string>;
  } catch {
    throw new Error("Invalid code workspace payload.");
  }

  await saveArtifactCodeWorkspace({
    projectId,
    artifactId,
    files
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}

export async function restoreArtifactVersionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const artifactId = String(formData.get("artifactId") ?? "").trim();
  const versionId = String(formData.get("versionId") ?? "").trim();

  if (!projectId || !artifactId || !versionId) {
    throw new Error("Project, artifact, and version are required.");
  }

  await restoreArtifactVersion({
    projectId,
    artifactId,
    versionId
  });

  revalidatePath(getStudioPath(projectId, artifactId));
}
