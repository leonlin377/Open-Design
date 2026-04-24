import { describe, expect, test } from "vitest";

import {
  appendRootSceneNode,
  buildPrototypeScreen,
  buildPrototypeScreenCta,
  buildPrototypeScreenLink,
  buildSlide,
  buildWebsiteSection,
  createEmptySceneDocument,
  indexSceneNodesById,
  updateRootSceneNode,
  validatePrototypeSceneDocument,
  validateSceneDocumentByKind,
  validateSlidesSceneDocument,
  validateWebsiteSceneDocument
} from "../src/index";

describe("createEmptySceneDocument", () => {
  test("creates a deterministic empty scene document from explicit ids", () => {
    const scene = createEmptySceneDocument({
      id: "scene_1",
      artifactId: "artifact_1",
      kind: "prototype"
    });

    expect(scene).toEqual({
      id: "scene_1",
      artifactId: "artifact_1",
      kind: "prototype",
      version: 1,
      nodes: [],
      metadata: {}
    });
  });
});

describe("indexSceneNodesById", () => {
  test("indexes nested nodes by id", () => {
    const index = indexSceneNodesById([
      {
        id: "root",
        type: "frame",
        name: "Root",
        props: {},
        children: [
          {
            id: "hero",
            type: "section",
            name: "Hero",
            props: {},
            children: []
          }
        ]
      }
    ]);

    expect(index.get("root")?.name).toBe("Root");
    expect(index.get("hero")?.type).toBe("section");
  });

  test("throws when duplicate node ids are encountered", () => {
    expect(() =>
      indexSceneNodesById([
        {
          id: "dup",
          type: "frame",
          name: "A",
          props: {},
          children: []
        },
        {
          id: "dup",
          type: "frame",
          name: "B",
          props: {},
          children: []
        }
      ])
    ).toThrowError(/duplicate/i);
  });
});

describe("appendRootSceneNode", () => {
  test("appends a root node and increments the scene version", () => {
    const scene = createEmptySceneDocument({
      id: "scene_1",
      artifactId: "artifact_1",
      kind: "prototype",
      version: 3
    });

    const nextScene = appendRootSceneNode(scene, {
      id: "root",
      type: "frame",
      name: "Root",
      props: {},
      children: []
    });

    expect(nextScene).toEqual({
      ...scene,
      version: 4,
      nodes: [
        {
          id: "root",
          type: "frame",
          name: "Root",
          props: {},
          children: []
        }
      ]
    });
    expect(scene).toEqual({
      ...scene,
      version: 3,
      nodes: []
    });
  });
});

describe("updateRootSceneNode", () => {
  test("updates a root node and increments version", () => {
    const scene = {
      ...createEmptySceneDocument({
        id: "scene_1",
        artifactId: "artifact_1",
        kind: "website",
        version: 2
      }),
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            headline: "Original headline"
          },
          children: []
        }
      ]
    };

    const nextScene = updateRootSceneNode(scene, {
      nodeId: "hero_1",
      name: "Updated Hero",
      props: {
        headline: "Updated headline",
        body: "Updated body"
      }
    });

    expect(nextScene.version).toBe(3);
    expect(nextScene.nodes[0]).toMatchObject({
      id: "hero_1",
      name: "Updated Hero",
      props: {
        template: "hero",
        headline: "Updated headline",
        body: "Updated body"
      }
    });
    expect(scene.nodes[0]).toMatchObject({
      name: "Hero Section",
      props: {
        headline: "Original headline"
      }
    });
  });

  test("throws when the node is missing", () => {
    const scene = createEmptySceneDocument({
      id: "scene_1",
      artifactId: "artifact_1",
      kind: "website"
    });

    expect(() =>
      updateRootSceneNode(scene, {
        nodeId: "missing",
        props: {
          headline: "Nope"
        }
      })
    ).toThrowError(/not found/i);
  });
});

describe("per-artifact-kind template factories", () => {
  test("buildPrototypeScreen produces a type=screen node", () => {
    const node = buildPrototypeScreen({
      id: "screen_1",
      name: "Welcome",
      headline: "Start"
    });

    expect(node.type).toBe("screen");
    expect(node.name).toBe("Welcome");
    expect(node.props.headline).toBe("Start");
  });

  test("buildPrototypeScreenLink produces a type=screen-link node with endpoints", () => {
    const node = buildPrototypeScreenLink({
      id: "link_1",
      from: "screen_1",
      to: "screen_2"
    });

    expect(node.type).toBe("screen-link");
    expect(node.props.from).toBe("screen_1");
    expect(node.props.to).toBe("screen_2");
    expect(node.props.trigger).toBe("tap");
  });

  test("buildPrototypeScreenCta produces a type=screen-cta node with actions", () => {
    const node = buildPrototypeScreenCta({
      id: "cta_1",
      primaryAction: "Next"
    });

    expect(node.type).toBe("screen-cta");
    expect(node.props.primaryAction).toBe("Next");
  });

  test("buildSlide produces a type matching the requested slide role", () => {
    const title = buildSlide({ id: "s1", role: "slide-title", headline: "Atlas Q2" });
    const content = buildSlide({
      id: "s2",
      role: "slide-content",
      bullets: ["A", "B"]
    });
    const closing = buildSlide({ id: "s3", role: "slide-closing" });

    expect(title.type).toBe("slide-title");
    expect(content.type).toBe("slide-content");
    expect(content.props.bullets).toEqual(["A", "B"]);
    expect(closing.type).toBe("slide-closing");
  });
});

describe("per-artifact-kind scene document validators", () => {
  test("validatePrototypeSceneDocument accepts prototype scenes with typed nodes", () => {
    const base = createEmptySceneDocument({
      id: "scene_proto",
      artifactId: "artifact_proto",
      kind: "prototype"
    });
    const scene = appendRootSceneNode(base, buildPrototypeScreen({ id: "screen_1" }));
    const withLink = appendRootSceneNode(
      scene,
      buildPrototypeScreenLink({ id: "link_1", from: "screen_1", to: "screen_1" })
    );

    const validated = validatePrototypeSceneDocument(withLink);
    expect(validated.kind).toBe("prototype");
    expect(validated.nodes.map((node) => node.type)).toEqual(["screen", "screen-link"]);
  });

  test("validateSlidesSceneDocument accepts slides with slide-* typed nodes", () => {
    const base = createEmptySceneDocument({
      id: "scene_slides",
      artifactId: "artifact_slides",
      kind: "slides"
    });
    const scene = [
      buildSlide({ id: "s1", role: "slide-title" }),
      buildSlide({ id: "s2", role: "slide-content" }),
      buildSlide({ id: "s3", role: "slide-closing" })
    ].reduce(appendRootSceneNode, base);

    const validated = validateSlidesSceneDocument(scene);
    expect(validated.nodes.map((node) => node.type)).toEqual([
      "slide-title",
      "slide-content",
      "slide-closing"
    ]);
  });

  test("rejects a prototype scene that embeds a website template node type", () => {
    const base = createEmptySceneDocument({
      id: "scene_bad",
      artifactId: "artifact_bad",
      kind: "prototype"
    });
    const scene = appendRootSceneNode(
      base,
      buildWebsiteSection({ id: "hero_1", template: "hero" })
    );

    expect(() => validatePrototypeSceneDocument(scene)).toThrowError(
      /Prototype scene nodes/
    );
  });

  test("rejects a website scene that embeds a prototype template node type", () => {
    const base = createEmptySceneDocument({
      id: "scene_bad",
      artifactId: "artifact_bad",
      kind: "website"
    });
    const scene = appendRootSceneNode(base, buildPrototypeScreen({ id: "screen_1" }));

    expect(() => validateWebsiteSceneDocument(scene)).toThrowError(
      /Website scene nodes/
    );
  });

  test("validateSceneDocumentByKind dispatches by the document kind discriminator", () => {
    const websiteScene = appendRootSceneNode(
      createEmptySceneDocument({
        id: "scene_web",
        artifactId: "artifact_web",
        kind: "website"
      }),
      buildWebsiteSection({ id: "hero_1", template: "hero" })
    );

    const validated = validateSceneDocumentByKind(websiteScene);
    expect(validated.kind).toBe("website");

    // Cross-kind: label the scene as prototype but contents are website-style
    const mislabeled = {
      ...websiteScene,
      kind: "prototype" as const
    };
    expect(() => validateSceneDocumentByKind(mislabeled)).toThrowError();
  });
});
