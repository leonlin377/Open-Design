import type { ArtifactKind, SceneDocument, SceneNode } from "@opendesign/contracts";

export type EmptySceneDocumentInput = {
  id: string;
  artifactId: string;
  kind: ArtifactKind;
  version?: number;
  metadata?: SceneDocument["metadata"];
};

export type SceneNodeIndex = Map<string, SceneNode>;

export const createEmptySceneDocument = (
  input: EmptySceneDocumentInput
): SceneDocument => {
  const { id, artifactId, kind, version = 1, metadata = {} } = input;

  return {
    id,
    artifactId,
    kind,
    version,
    nodes: [],
    metadata
  };
};

export const appendRootSceneNode = (
  scene: SceneDocument,
  node: SceneNode
): SceneDocument => {
  return {
    ...scene,
    version: scene.version + 1,
    nodes: [...scene.nodes, node]
  };
};

export const indexSceneNodesById = (nodes: SceneNode[]): SceneNodeIndex => {
  const index = new Map<string, SceneNode>();
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    if (index.has(node.id)) {
      throw new Error(`Duplicate scene node id: ${node.id}`);
    }

    index.set(node.id, node);
    if (node.children.length > 0) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }

  return index;
};
