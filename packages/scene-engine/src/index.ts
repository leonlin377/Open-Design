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

export const updateRootSceneNode = (
  scene: SceneDocument,
  input: {
    nodeId: string;
    name?: string;
    props?: Record<string, unknown>;
  }
): SceneDocument => {
  const index = scene.nodes.findIndex((node) => node.id === input.nodeId);

  if (index === -1) {
    throw new Error(`Scene node not found: ${input.nodeId}`);
  }

  const current = scene.nodes[index]!;
  const nextNode: SceneNode = {
    ...current,
    ...(input.name ? { name: input.name } : {}),
    props: {
      ...current.props,
      ...(input.props ?? {})
    }
  };

  const nodes = [...scene.nodes];
  nodes[index] = nextNode;

  return {
    ...scene,
    version: scene.version + 1,
    nodes
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
