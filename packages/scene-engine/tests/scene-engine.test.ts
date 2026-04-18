import { describe, expect, test } from "vitest";

import {
  appendRootSceneNode,
  createEmptySceneDocument,
  indexSceneNodesById,
  updateRootSceneNode
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
