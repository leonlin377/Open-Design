import { describe, expect, test } from "vitest";
import { createEmptySceneDocument } from "@opendesign/scene-engine";

import { planSyncPatch, syncSceneToCodeWorkspace } from "../src/index";

describe("planSyncPatch", () => {
  test("uses a full sync plan for supported round-trip code edits", () => {
    expect(
      planSyncPatch({
        sourceMode: "code-supported",
        targetMode: "scene",
        changeScope: "node"
      })
    ).toEqual({
      mode: "full",
      reason: "Supported code can round-trip into scene structures.",
      sourceMode: "code-supported",
      targetMode: "scene",
      changeScope: "node"
    });
  });

  test("uses a constrained sync plan for advanced code edits", () => {
    expect(
      planSyncPatch({
        sourceMode: "code-advanced",
        targetMode: "scene",
        changeScope: "section"
      })
    ).toEqual({
      mode: "constrained",
      reason: "Advanced code can only safely sync at section granularity.",
      sourceMode: "code-advanced",
      targetMode: "scene",
      changeScope: "section"
    });
  });
});

describe("syncSceneToCodeWorkspace", () => {
  test("seeds a generated scaffold when no code workspace exists yet", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_1",
      kind: "website"
    });
    const nextSceneDocument = {
      ...previousSceneDocument,
      version: 2,
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            headline: "Cinematic launch copy",
            body: "Launch body"
          },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "website",
      artifactName: "Atlas",
      previousIntent: "Seed prompt",
      nextIntent: "Seed prompt",
      previousSceneDocument,
      nextSceneDocument,
      currentCodeWorkspace: null
    });

    expect(decision.applied).toBe(true);
    expect(decision.codeWorkspace?.baseSceneVersion).toBe(2);
    expect(decision.codeWorkspace?.files["/App.tsx"]).toContain("Hero Section");
    expect(decision.filesTouched).toContain("/App.tsx");
  });

  test("regenerates the saved scaffold when it still matches the previous scene", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_1",
      kind: "website"
    });
    const sceneVersionTwo = {
      artifactId: "artifact_1",
      id: "scene_artifact_1",
      kind: "website" as const,
      metadata: {},
      version: 2,
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            headline: "Initial headline",
            body: "Initial body"
          },
          children: []
        }
      ]
    };
    const derivedDecision = syncSceneToCodeWorkspace({
      artifactKind: "website",
      artifactName: "Atlas",
      previousIntent: "Seed prompt",
      nextIntent: "Seed prompt",
      previousSceneDocument,
      nextSceneDocument: sceneVersionTwo,
      currentCodeWorkspace: null
    });
    const updatedSceneDocument = {
      artifactId: "artifact_1",
      id: "scene_artifact_1",
      kind: "website" as const,
      metadata: {},
      version: 3,
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            headline: "Updated headline",
            body: "Initial body"
          },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "website",
      artifactName: "Atlas",
      previousIntent: "Seed prompt",
      nextIntent: "Seed prompt",
      previousSceneDocument: sceneVersionTwo,
      nextSceneDocument: updatedSceneDocument,
      currentCodeWorkspace: {
        ...derivedDecision.codeWorkspace!,
        updatedAt: "2026-04-19T00:00:00.000Z"
      }
    });

    expect(decision.applied).toBe(true);
    expect(decision.codeWorkspace?.baseSceneVersion).toBe(3);
    expect(decision.codeWorkspace?.files["/App.tsx"]).toContain("Updated headline");
    expect(decision.filesTouched).toContain("/App.tsx");
  });

  test("preserves a diverged saved scaffold", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_1",
      kind: "website"
    });
    const nextSceneDocument = {
      ...previousSceneDocument,
      version: 2,
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            headline: "Updated headline",
            body: "Updated body"
          },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "website",
      artifactName: "Atlas",
      previousIntent: "Seed prompt",
      nextIntent: "Seed prompt",
      previousSceneDocument,
      nextSceneDocument,
      currentCodeWorkspace: {
        files: {
          "/App.tsx":
            'export default function App() { return <main>custom preserved scaffold</main>; }'
        },
        baseSceneVersion: 1,
        updatedAt: "2026-04-19T00:00:00.000Z"
      }
    });

    expect(decision.applied).toBe(false);
    expect(decision.codeWorkspace).toBeNull();
    expect(decision.reason).toContain("preserved");
  });
});
