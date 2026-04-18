import { describe, expect, test } from "vitest";

import { createEmptySceneDocument, indexSceneNodesById } from "../src/index";

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
