import type {
  ArtifactKind,
  PrototypeSceneDocument,
  PrototypeSceneTemplateKind,
  SceneDocument,
  SceneNode,
  SlidesSceneDocument,
  SlidesSceneTemplateKind,
  WebsiteSceneDocument,
  WebsiteSceneTemplateKind
} from "@opendesign/contracts";
import {
  PrototypeSceneDocumentSchema,
  SlidesSceneDocumentSchema,
  TypedSceneDocumentSchema,
  WebsiteSceneDocumentSchema
} from "@opendesign/contracts";

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

// -----------------------------------------------------------------------------
// Per-artifact-kind template factories.
//
// Each factory produces a scene node whose runtime `type` matches the typed
// vocabulary enforced by the per-kind scene schemas in @opendesign/contracts.
// These replace the previous "generic section with a template prop" pattern
// that could not be distinguished across artifact kinds.
// -----------------------------------------------------------------------------

export type WebsiteTemplateNodeInput = {
  id: string;
  template: WebsiteSceneTemplateKind;
  name?: string;
  props?: Record<string, unknown>;
};

export const buildWebsiteSection = (input: WebsiteTemplateNodeInput): SceneNode => {
  return {
    id: input.id,
    type: "section",
    name: input.name ?? `${input.template} section`,
    props: {
      template: input.template,
      ...(input.props ?? {})
    },
    children: []
  };
};

export type PrototypeScreenInput = {
  id: string;
  name?: string;
  headline?: string;
  body?: string;
  eyebrow?: string;
  props?: Record<string, unknown>;
};

export const buildPrototypeScreen = (input: PrototypeScreenInput): SceneNode => {
  return {
    id: input.id,
    type: "screen" satisfies PrototypeSceneTemplateKind,
    name: input.name ?? "Screen",
    props: {
      eyebrow: input.eyebrow ?? "Flow Surface",
      headline: input.headline ?? "Screen headline",
      body: input.body ?? "Guide the user to the next flow step.",
      ...(input.props ?? {})
    },
    children: []
  };
};

export type PrototypeScreenLinkInput = {
  id: string;
  from: string;
  to: string;
  trigger?: "tap" | "swipe" | "auto";
  name?: string;
  props?: Record<string, unknown>;
};

export const buildPrototypeScreenLink = (
  input: PrototypeScreenLinkInput
): SceneNode => {
  return {
    id: input.id,
    type: "screen-link" satisfies PrototypeSceneTemplateKind,
    name: input.name ?? `${input.from} → ${input.to}`,
    props: {
      from: input.from,
      to: input.to,
      trigger: input.trigger ?? "tap",
      ...(input.props ?? {})
    },
    children: []
  };
};

export type PrototypeScreenCtaInput = {
  id: string;
  name?: string;
  headline?: string;
  primaryAction?: string;
  secondaryAction?: string;
  props?: Record<string, unknown>;
};

export const buildPrototypeScreenCta = (
  input: PrototypeScreenCtaInput
): SceneNode => {
  return {
    id: input.id,
    type: "screen-cta" satisfies PrototypeSceneTemplateKind,
    name: input.name ?? "Action Screen",
    props: {
      headline: input.headline ?? "Confirm the next step.",
      primaryAction: input.primaryAction ?? "Continue",
      secondaryAction: input.secondaryAction ?? "Back",
      ...(input.props ?? {})
    },
    children: []
  };
};

export type SlideRole = SlidesSceneTemplateKind;

export type SlideInput = {
  id: string;
  role: SlideRole;
  name?: string;
  headline?: string;
  body?: string;
  bullets?: string[];
  props?: Record<string, unknown>;
};

export const buildSlide = (input: SlideInput): SceneNode => {
  const defaultName: Record<SlideRole, string> = {
    "slide-title": "Title Slide",
    "slide-content": "Content Slide",
    "slide-closing": "Closing Slide"
  };

  return {
    id: input.id,
    type: input.role,
    name: input.name ?? defaultName[input.role],
    props: {
      headline: input.headline ?? defaultName[input.role],
      ...(input.body ? { body: input.body } : {}),
      ...(input.bullets ? { bullets: input.bullets } : {}),
      ...(input.props ?? {})
    },
    children: []
  };
};

// -----------------------------------------------------------------------------
// Per-artifact-kind document validators. These return the typed document on
// success and throw a ZodError on mismatch — e.g. when a prototype document
// contains website-only node types or vice versa.
// -----------------------------------------------------------------------------

export const validateWebsiteSceneDocument = (
  scene: SceneDocument
): WebsiteSceneDocument => WebsiteSceneDocumentSchema.parse(scene);

export const validatePrototypeSceneDocument = (
  scene: SceneDocument
): PrototypeSceneDocument => PrototypeSceneDocumentSchema.parse(scene);

export const validateSlidesSceneDocument = (
  scene: SceneDocument
): SlidesSceneDocument => SlidesSceneDocumentSchema.parse(scene);

export const validateSceneDocumentByKind = (scene: SceneDocument) =>
  TypedSceneDocumentSchema.parse(scene);
