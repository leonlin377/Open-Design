"use server";

import { revalidatePath } from "next/cache";
import { parseCommentAnchorTarget } from "../../../components/comment-anchor-options";
import {
  appendSharedSceneTemplate,
  createSharedArtifactComment,
  resolveSharedArtifactComment,
  updateSharedSceneNode
} from "../../../lib/opendesign-api";

function getSharedPath(token: string) {
  return `/share/${token}`;
}

export async function createSharedArtifactCommentAction(formData: FormData) {
  const shareToken = String(formData.get("shareToken") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const anchorTarget = String(formData.get("anchorTarget") ?? "").trim();

  if (!shareToken || !body) {
    throw new Error("Share token and comment body are required.");
  }

  const anchor = parseCommentAnchorTarget(anchorTarget);

  if (!anchor) {
    throw new Error("Share comment anchor target is required.");
  }

  await createSharedArtifactComment({
    token: shareToken,
    body,
    anchor
  });

  revalidatePath(getSharedPath(shareToken));
}

export async function resolveSharedArtifactCommentAction(formData: FormData) {
  const shareToken = String(formData.get("shareToken") ?? "").trim();
  const commentId = String(formData.get("commentId") ?? "").trim();

  if (!shareToken || !commentId) {
    throw new Error("Share token and comment id are required.");
  }

  await resolveSharedArtifactComment({
    token: shareToken,
    commentId
  });

  revalidatePath(getSharedPath(shareToken));
}

export async function appendSharedSceneTemplateAction(formData: FormData) {
  const shareToken = String(formData.get("shareToken") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim() as
    | "hero"
    | "feature-grid"
    | "cta";

  if (!shareToken || !template) {
    throw new Error("Share token and template are required.");
  }

  await appendSharedSceneTemplate({
    token: shareToken,
    template
  });

  revalidatePath(getSharedPath(shareToken));
}

export async function updateSharedSceneNodeAction(formData: FormData) {
  const shareToken = String(formData.get("shareToken") ?? "").trim();
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

  if (!shareToken || !nodeId) {
    throw new Error("Share token and scene node are required.");
  }

  await updateSharedSceneNode({
    token: shareToken,
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

  revalidatePath(getSharedPath(shareToken));
}
