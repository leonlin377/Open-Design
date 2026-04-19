import type { CommentAnchor, SceneNode } from "@opendesign/contracts";

export type CommentAnchorOption = {
  value: string;
  label: string;
};

export function buildCommentAnchorOptions(
  sceneNodes: SceneNode[],
  canvasLabel = "Artifact Canvas"
) {
  const options: CommentAnchorOption[] = [
    {
      value: "artifact-canvas::artifact-canvas",
      label: canvasLabel
    }
  ];

  for (const node of sceneNodes) {
    options.push({
      value: `${node.id}::scene/${node.id}`,
      label: node.name
    });
  }

  return options;
}

export function parseCommentAnchorTarget(value: string): CommentAnchor | null {
  const [elementId, selectionPathValue] = value.split("::");

  if (!elementId || !selectionPathValue) {
    return null;
  }

  const selectionPath = selectionPathValue
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (selectionPath.length === 0) {
    return null;
  }

  return {
    elementId,
    selectionPath
  };
}
