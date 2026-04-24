import { describe, expect, test } from "vitest";
import { buildArtifactSourceBundle } from "@opendesign/exporters";
import { createEmptySceneDocument } from "@opendesign/scene-engine";

import {
  planSyncPatch,
  syncCodeToSceneDocument,
  syncSceneToCodeWorkspace
} from "../src/index";

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

  test("regenerates a legacy saved scaffold that only lacks the sync payload file", () => {
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
    const legacyFiles = { ...derivedDecision.codeWorkspace!.files };
    delete legacyFiles["/opendesign.sync.json"];
    const updatedSceneDocument = {
      ...sceneVersionTwo,
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
        files: legacyFiles,
        baseSceneVersion: 2,
        updatedAt: "2026-04-19T00:00:00.000Z"
      }
    });

    expect(decision.applied).toBe(true);
    expect(decision.codeWorkspace?.files["/opendesign.sync.json"]).toContain(
      '"headline": "Updated headline"'
    );
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

describe("syncCodeToSceneDocument", () => {
  test("updates a website scene from the stable sync payload", () => {
    const currentSceneDocument = {
      ...createEmptySceneDocument({
        artifactId: "artifact_1",
        kind: "website"
      }),
      version: 2,
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            eyebrow: "Launch Surface",
            headline: "Initial headline",
            body: "Initial body"
          },
          children: []
        }
      ]
    };
    const bundle = buildArtifactSourceBundle({
      artifactKind: "website",
      artifactName: "Atlas",
      prompt: "Seed prompt",
      sceneNodes: currentSceneDocument.nodes
    });
    const syncPayload = JSON.parse(bundle.files["/opendesign.sync.json"]!);
    syncPayload.sections[0].headline = "Updated from sync payload";
    syncPayload.sections[0].body = "Updated body from sync payload";

    const decision = syncCodeToSceneDocument({
      artifactKind: "website",
      currentSceneDocument,
      files: {
        ...bundle.files,
        "/opendesign.sync.json": JSON.stringify(syncPayload, null, 2)
      }
    });

    expect(decision.applied).toBe(true);
    expect(decision.sceneDocument?.version).toBe(3);
    expect(decision.sceneDocument?.nodes[0]).toMatchObject({
      props: {
        headline: "Updated from sync payload",
        body: "Updated body from sync payload"
      }
    });
  });

  test("updates a website scene from supported App.tsx sections data", () => {
    const currentSceneDocument = {
      ...createEmptySceneDocument({
        artifactId: "artifact_1",
        kind: "website"
      }),
      version: 2,
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            eyebrow: "Launch Surface",
            headline: "Initial headline",
            body: "Initial body"
          },
          children: []
        }
      ]
    };
    const bundle = buildArtifactSourceBundle({
      artifactKind: "website",
      artifactName: "Atlas",
      prompt: "Seed prompt",
      sceneNodes: currentSceneDocument.nodes
    });

    const decision = syncCodeToSceneDocument({
      artifactKind: "website",
      currentSceneDocument,
      files: {
        ...bundle.files,
        "/opendesign.sync.json": "",
        "/App.tsx": bundle.files["/App.tsx"]!
          .replace("Initial headline", "Updated from code")
          .replace("Initial body", "Updated body from code")
      }
    });

    expect(decision.applied).toBe(true);
    expect(decision.sceneDocument?.version).toBe(3);
    expect(decision.sceneDocument?.nodes[0]).toMatchObject({
      props: {
        headline: "Updated from code",
        body: "Updated body from code"
      }
    });
    expect(decision.reason).toContain("legacy");
  });

  test("fails closed when the stable sync payload is invalid", () => {
    const currentSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_1",
      kind: "website"
    });
    const bundle = buildArtifactSourceBundle({
      artifactKind: "website",
      artifactName: "Atlas",
      prompt: "Seed prompt",
      sceneNodes: currentSceneDocument.nodes
    });

    const decision = syncCodeToSceneDocument({
      artifactKind: "website",
      currentSceneDocument,
      files: {
        ...bundle.files,
        "/opendesign.sync.json": JSON.stringify({
          version: 1,
          sections: [{ id: "hero_1", template: "hero" }, { id: "hero_1", template: "cta" }]
        })
      }
    });

    expect(decision.applied).toBe(false);
    expect(decision.sceneDocument).toBeNull();
    expect(decision.reason).toContain("unsupported");
  });

  test("preserves scene when App.tsx is no longer a supported scaffold", () => {
    const currentSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_1",
      kind: "website"
    });

    const decision = syncCodeToSceneDocument({
      artifactKind: "website",
      currentSceneDocument,
      files: {
        "/App.tsx":
          "export default function App() { return <main>custom preserved scaffold</main>; }",
        "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
        "/styles.css": "main { color: rebeccapurple; }",
        "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
        "/package.json": '{"name":"preserve-code","private":true}'
      }
    });

    expect(decision.applied).toBe(false);
    expect(decision.sceneDocument).toBeNull();
    expect(decision.reason).toContain("unsupported");
  });

  // -------------------------------------------------------------------------
  // SYNC-004 extended surface: named-export website scaffold, prototype
  // `const screens = [...]`, and slides `const slides = [...]`.
  // -------------------------------------------------------------------------

  test("updates a website scene from the `export const sections` scaffold variant", () => {
    const currentSceneDocument = {
      ...createEmptySceneDocument({
        artifactId: "artifact_1",
        kind: "website"
      }),
      version: 2,
      nodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            eyebrow: "Launch Surface",
            headline: "Initial headline",
            body: "Initial body"
          },
          children: []
        }
      ]
    };
    const sectionsLiteral = JSON.stringify([
      {
        id: "hero_1",
        template: "hero",
        name: "Hero Section",
        eyebrow: "Launch Surface",
        headline: "Updated from named export",
        body: "Updated body"
      }
    ]);
    const appCode = `import "./styles.css";\n\nexport const sections = ${sectionsLiteral};\n\nexport default function App() {\n  return (<main>{sections.length}</main>);\n}\n`;

    const decision = syncCodeToSceneDocument({
      artifactKind: "website",
      currentSceneDocument,
      files: {
        "/App.tsx": appCode,
        // No sync payload — force the App.tsx parsing branch.
        "/opendesign.sync.json": ""
      }
    });

    expect(decision.applied).toBe(true);
    expect(decision.sceneDocument?.version).toBe(3);
    expect(decision.sceneDocument?.nodes[0]).toMatchObject({
      id: "hero_1",
      type: "section",
      props: {
        template: "hero",
        headline: "Updated from named export",
        body: "Updated body"
      }
    });
  });

  test("fails closed when website App.tsx lacks any supported scaffold shape", () => {
    const currentSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_1",
      kind: "website"
    });

    const decision = syncCodeToSceneDocument({
      artifactKind: "website",
      currentSceneDocument,
      files: {
        "/App.tsx":
          'export default function App(){ return <main>hand authored</main>; }'
      }
    });

    expect(decision.applied).toBe(false);
    expect(decision.sceneDocument).toBeNull();
    expect(decision.reason).toContain(
      "expected `const sections = [...]`, `export const sections = [...]`, `const screens = [...]`, or `const slides = [...]`"
    );
  });

  test("updates a prototype scene from a `const screens = [...]` scaffold", () => {
    const currentSceneDocument = {
      ...createEmptySceneDocument({
        artifactId: "artifact_2",
        kind: "prototype"
      }),
      version: 4,
      nodes: [
        {
          id: "screen_1",
          type: "screen",
          name: "Welcome",
          props: { headline: "Welcome", body: "Intro body" },
          children: []
        }
      ]
    };
    const screensLiteral = JSON.stringify([
      {
        id: "screen_1",
        name: "Welcome",
        headline: "Welcome, traveler",
        body: "Updated intro body"
      },
      {
        id: "screen_2",
        name: "Details",
        headline: "Review details",
        body: "Confirm the plan"
      }
    ]);
    const appCode = `import "./styles.css";\n\nconst screens = ${screensLiteral};\n\nexport default function App() {\n  return (<main>{screens.length}</main>);\n}\n`;

    const decision = syncCodeToSceneDocument({
      artifactKind: "prototype",
      currentSceneDocument,
      files: { "/App.tsx": appCode }
    });

    expect(decision.applied).toBe(true);
    expect(decision.sceneDocument?.version).toBe(5);
    expect(decision.sceneDocument?.nodes).toEqual([
      {
        id: "screen_1",
        type: "screen",
        name: "Welcome",
        props: { headline: "Welcome, traveler", body: "Updated intro body" },
        children: []
      },
      {
        id: "screen_2",
        type: "screen",
        name: "Details",
        props: { headline: "Review details", body: "Confirm the plan" },
        children: []
      }
    ]);
    expect(decision.reason).toContain("prototype scaffold");
  });

  test("fails closed when a prototype `screens` entry uses an unknown type", () => {
    const currentSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_2",
      kind: "prototype"
    });
    const screensLiteral = JSON.stringify([
      {
        id: "screen_popover_1",
        type: "screen-popover"
      }
    ]);
    const appCode = `const screens = ${screensLiteral};\n\nexport default function App() {\n  return null;\n}\n`;

    const decision = syncCodeToSceneDocument({
      artifactKind: "prototype",
      currentSceneDocument,
      files: { "/App.tsx": appCode }
    });

    expect(decision.applied).toBe(false);
    expect(decision.sceneDocument).toBeNull();
    expect(decision.reason).toContain("unsupported");
    expect(decision.reason).toContain("screen-popover");
  });

  test("fails closed when a prototype workspace lacks a screens scaffold", () => {
    const currentSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_2",
      kind: "prototype"
    });

    const decision = syncCodeToSceneDocument({
      artifactKind: "prototype",
      currentSceneDocument,
      files: {
        "/App.tsx":
          'export default function App(){ return <main>hand authored</main>; }'
      }
    });

    expect(decision.applied).toBe(false);
    expect(decision.sceneDocument).toBeNull();
    expect(decision.reason).toContain("prototype scaffold");
    expect(decision.reason).toContain("`const screens = [...]`");
  });

  test("round-trips a prototype `screens` scaffold back to the starting scene", () => {
    const startingNodes = [
      {
        id: "screen_a",
        type: "screen",
        name: "A",
        props: { headline: "Alpha", body: "alpha body" },
        children: []
      },
      {
        id: "screen_b",
        type: "screen",
        name: "B",
        props: { headline: "Bravo", body: "bravo body" },
        children: []
      }
    ];
    const startingScene = {
      ...createEmptySceneDocument({
        artifactId: "artifact_round_trip",
        kind: "prototype"
      }),
      version: 7,
      nodes: startingNodes
    };

    // Emit a scene-derived `const screens = [...]` scaffold using the same
    // typed node vocabulary the parser expects. This is the code-generation
    // shape SYNC-004 commits to supporting.
    const screensLiteral = JSON.stringify(
      startingNodes.map((node) => ({
        id: node.id,
        name: node.name,
        headline: node.props.headline,
        body: node.props.body
      }))
    );
    const appCode = `const screens = ${screensLiteral};\n\nexport default function App(){ return null; }`;

    // Simulate a code edit: nudge headline B.
    const editedCode = appCode.replace("Bravo", "Bravo!");

    const after = syncCodeToSceneDocument({
      artifactKind: "prototype",
      currentSceneDocument: startingScene,
      files: { "/App.tsx": editedCode }
    });
    expect(after.applied).toBe(true);

    // Now revert the edit and sync again — we should return to the original
    // node set exactly (modulo version bump).
    const reverted = syncCodeToSceneDocument({
      artifactKind: "prototype",
      currentSceneDocument: after.sceneDocument!,
      files: { "/App.tsx": appCode }
    });
    expect(reverted.applied).toBe(true);
    expect(reverted.sceneDocument?.nodes).toEqual(startingNodes);
  });

  test("updates a slides scene from a `const slides = [...]` scaffold", () => {
    const currentSceneDocument = {
      ...createEmptySceneDocument({
        artifactId: "artifact_3",
        kind: "slides"
      }),
      version: 1,
      nodes: []
    };
    const slidesLiteral = JSON.stringify([
      {
        id: "slide_1",
        role: "slide-title",
        name: "Title",
        headline: "Q2 Launch Plan",
        body: "Atlas moves to GA."
      },
      {
        id: "slide_2",
        role: "slide-content",
        name: "Plan",
        headline: "Week one",
        body: "Priorities for the first week.",
        bullets: ["Ship preview", "Share changelog"]
      },
      {
        id: "slide_3",
        role: "slide-closing",
        name: "Close",
        headline: "Next steps",
        body: "Download the deck."
      }
    ]);
    const appCode = `import "./styles.css";\n\nconst slides = ${slidesLiteral};\n\nexport default function App(){ return <main>{slides.length}</main>; }\n`;

    const decision = syncCodeToSceneDocument({
      artifactKind: "slides",
      currentSceneDocument,
      files: { "/App.tsx": appCode }
    });

    expect(decision.applied).toBe(true);
    expect(decision.sceneDocument?.version).toBe(2);
    expect(decision.sceneDocument?.nodes).toEqual([
      {
        id: "slide_1",
        type: "slide-title",
        name: "Title",
        props: { headline: "Q2 Launch Plan", body: "Atlas moves to GA." },
        children: []
      },
      {
        id: "slide_2",
        type: "slide-content",
        name: "Plan",
        props: {
          headline: "Week one",
          body: "Priorities for the first week.",
          bullets: ["Ship preview", "Share changelog"]
        },
        children: []
      },
      {
        id: "slide_3",
        type: "slide-closing",
        name: "Close",
        props: { headline: "Next steps", body: "Download the deck." },
        children: []
      }
    ]);
    expect(decision.reason).toContain("slides scaffold");
  });

  test("fails closed when a slide entry uses an unsupported role", () => {
    const currentSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_3",
      kind: "slides"
    });
    const slidesLiteral = JSON.stringify([
      {
        id: "slide_x",
        role: "slide-intermission",
        headline: "Intermission"
      }
    ]);
    const appCode = `const slides = ${slidesLiteral};\n\nexport default function App(){ return null; }\n`;

    const decision = syncCodeToSceneDocument({
      artifactKind: "slides",
      currentSceneDocument,
      files: { "/App.tsx": appCode }
    });

    expect(decision.applied).toBe(false);
    expect(decision.sceneDocument).toBeNull();
    expect(decision.reason).toContain("slide-intermission");
  });

  test("round-trips a slides scaffold back to the starting scene", () => {
    const startingNodes = [
      {
        id: "slide_1",
        type: "slide-title",
        name: "Title",
        props: { headline: "Kickoff", body: "Team priorities" },
        children: []
      },
      {
        id: "slide_2",
        type: "slide-content",
        name: "Plan",
        props: {
          headline: "Focus",
          body: "Core bets",
          bullets: ["Alpha", "Beta"]
        },
        children: []
      }
    ];
    const startingScene = {
      ...createEmptySceneDocument({
        artifactId: "artifact_round_trip_slides",
        kind: "slides"
      }),
      version: 3,
      nodes: startingNodes
    };

    const slidesLiteral = JSON.stringify(
      startingNodes.map((node) => ({
        id: node.id,
        role: node.type,
        name: node.name,
        headline: node.props.headline,
        body: node.props.body,
        ...(Array.isArray((node.props as { bullets?: unknown }).bullets)
          ? { bullets: (node.props as { bullets: string[] }).bullets }
          : {})
      }))
    );
    const appCode = `const slides = ${slidesLiteral};\n\nexport default function App(){ return null; }`;
    const editedCode = appCode.replace("Kickoff", "Kickoff!!");

    const after = syncCodeToSceneDocument({
      artifactKind: "slides",
      currentSceneDocument: startingScene,
      files: { "/App.tsx": editedCode }
    });
    expect(after.applied).toBe(true);

    const reverted = syncCodeToSceneDocument({
      artifactKind: "slides",
      currentSceneDocument: after.sceneDocument!,
      files: { "/App.tsx": appCode }
    });
    expect(reverted.applied).toBe(true);
    expect(reverted.sceneDocument?.nodes).toEqual(startingNodes);
  });

  // -------------------------------------------------------------------------
  // SYNC-005: extended code→scene parsing for prototype transitions / CTAs.
  // -------------------------------------------------------------------------

  test("updates a prototype scene from a mixed screens scaffold with links + CTAs", () => {
    const currentSceneDocument = {
      ...createEmptySceneDocument({
        artifactId: "artifact_mixed",
        kind: "prototype"
      }),
      version: 1,
      nodes: []
    };
    const screensLiteral = JSON.stringify([
      { id: "s_1", name: "Start", headline: "Welcome" },
      {
        id: "l_1",
        type: "screen-link",
        from: "s_1",
        to: "s_2",
        trigger: "tap"
      },
      {
        id: "c_1",
        type: "screen-cta",
        name: "Confirm",
        headline: "Ready?",
        primaryAction: "Go",
        secondaryAction: "Back"
      },
      { id: "s_2", name: "End", headline: "Done" }
    ]);
    const appCode = `const screens = ${screensLiteral};\n\nexport default function App(){ return null; }`;

    const decision = syncCodeToSceneDocument({
      artifactKind: "prototype",
      currentSceneDocument,
      files: { "/App.tsx": appCode }
    });

    expect(decision.applied).toBe(true);
    expect(decision.sceneDocument?.nodes.map((node) => [node.id, node.type]))
      .toEqual([
        ["s_1", "screen"],
        ["l_1", "screen-link"],
        ["c_1", "screen-cta"],
        ["s_2", "screen"]
      ]);
    expect(decision.sceneDocument?.nodes[1]!.props).toEqual({
      from: "s_1",
      to: "s_2",
      trigger: "tap"
    });
    expect(decision.sceneDocument?.nodes[2]!.props).toEqual({
      headline: "Ready?",
      primaryAction: "Go",
      secondaryAction: "Back"
    });
  });

  // -------------------------------------------------------------------------
  // SYNC-005: scene→code for prototype and slides, plus full round-trips.
  // -------------------------------------------------------------------------

  test("syncSceneToCodeWorkspace seeds a prototype scaffold", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_proto",
      kind: "prototype"
    });
    const nextSceneDocument = {
      ...previousSceneDocument,
      version: 2,
      nodes: [
        {
          id: "s_1",
          type: "screen",
          name: "Welcome",
          props: { headline: "Welcome", body: "Intro body" },
          children: []
        },
        {
          id: "l_1",
          type: "screen-link",
          name: "s_1 → s_2",
          props: { from: "s_1", to: "s_2", trigger: "tap" },
          children: []
        },
        {
          id: "c_1",
          type: "screen-cta",
          name: "Confirm",
          props: { headline: "Ready?", primaryAction: "Go" },
          children: []
        },
        {
          id: "s_2",
          type: "screen",
          name: "Done",
          props: { headline: "Done" },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "prototype",
      artifactName: "Atlas Flow",
      previousIntent: "Seed prompt",
      nextIntent: "Seed prompt",
      previousSceneDocument,
      nextSceneDocument,
      currentCodeWorkspace: null
    });

    expect(decision.applied).toBe(true);
    expect(decision.codeWorkspace?.baseSceneVersion).toBe(2);
    const appTsx = decision.codeWorkspace?.files["/App.tsx"] ?? "";
    expect(appTsx).toContain("const screens = ");
    expect(appTsx).toContain('"type": "screen-link"');
    expect(appTsx).toContain('"type": "screen-cta"');
    expect(decision.filesTouched).toContain("/App.tsx");
  });

  test("syncSceneToCodeWorkspace seeds a slides scaffold", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_slides",
      kind: "slides"
    });
    const nextSceneDocument = {
      ...previousSceneDocument,
      version: 2,
      nodes: [
        {
          id: "slide_1",
          type: "slide-title",
          name: "Kickoff",
          props: { headline: "Kickoff", body: "Priorities" },
          children: []
        },
        {
          id: "slide_2",
          type: "slide-content",
          name: "Plan",
          props: { headline: "Focus", bullets: ["Alpha", "Beta"] },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "slides",
      artifactName: "Atlas Deck",
      previousIntent: "Seed prompt",
      nextIntent: "Seed prompt",
      previousSceneDocument,
      nextSceneDocument,
      currentCodeWorkspace: null
    });

    expect(decision.applied).toBe(true);
    const appTsx = decision.codeWorkspace?.files["/App.tsx"] ?? "";
    expect(appTsx).toContain("const slides = ");
    expect(appTsx).toContain('"role": "slide-title"');
    expect(appTsx).toContain('"role": "slide-content"');
    expect(appTsx).toContain('"bullets"');
  });

  test("syncSceneToCodeWorkspace regenerates a matching prototype scaffold", () => {
    const sceneVersionTwo = {
      ...createEmptySceneDocument({
        artifactId: "artifact_proto_regen",
        kind: "prototype"
      }),
      version: 2,
      nodes: [
        {
          id: "s_1",
          type: "screen",
          name: "Welcome",
          props: { headline: "Welcome" },
          children: []
        }
      ]
    };
    const seeded = syncSceneToCodeWorkspace({
      artifactKind: "prototype",
      artifactName: "Atlas",
      previousIntent: "",
      nextIntent: "",
      previousSceneDocument: {
        ...sceneVersionTwo,
        version: 1,
        nodes: []
      },
      nextSceneDocument: sceneVersionTwo,
      currentCodeWorkspace: null
    });
    expect(seeded.applied).toBe(true);

    const sceneVersionThree = {
      ...sceneVersionTwo,
      version: 3,
      nodes: [
        {
          id: "s_1",
          type: "screen",
          name: "Welcome",
          props: { headline: "Welcome, traveler" },
          children: []
        }
      ]
    };

    const regen = syncSceneToCodeWorkspace({
      artifactKind: "prototype",
      artifactName: "Atlas",
      previousIntent: "",
      nextIntent: "",
      previousSceneDocument: sceneVersionTwo,
      nextSceneDocument: sceneVersionThree,
      currentCodeWorkspace: {
        ...seeded.codeWorkspace!,
        updatedAt: "2026-04-19T00:00:00.000Z"
      }
    });

    expect(regen.applied).toBe(true);
    expect(regen.codeWorkspace?.baseSceneVersion).toBe(3);
    expect(regen.codeWorkspace?.files["/App.tsx"]).toContain(
      "Welcome, traveler"
    );
  });

  test("syncSceneToCodeWorkspace preserves a diverged prototype scaffold", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_div",
      kind: "prototype"
    });
    const nextSceneDocument = {
      ...previousSceneDocument,
      version: 2,
      nodes: [
        {
          id: "s_1",
          type: "screen",
          name: "Welcome",
          props: { headline: "New" },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "prototype",
      artifactName: "Atlas",
      previousIntent: "",
      nextIntent: "",
      previousSceneDocument,
      nextSceneDocument,
      currentCodeWorkspace: {
        files: {
          "/App.tsx":
            "export default function App(){ return <main>custom</main>; }"
        },
        baseSceneVersion: 1,
        updatedAt: "2026-04-19T00:00:00.000Z"
      }
    });

    expect(decision.applied).toBe(false);
    expect(decision.codeWorkspace).toBeNull();
    expect(decision.reason).toContain("diverged");
  });

  test("syncSceneToCodeWorkspace fails closed when a prototype node has unsupported props", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_bad",
      kind: "prototype"
    });
    const nextSceneDocument = {
      ...previousSceneDocument,
      version: 2,
      nodes: [
        {
          id: "s_1",
          type: "screen",
          name: "Welcome",
          props: { headline: "ok", analytics: { events: 4 } },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "prototype",
      artifactName: "Atlas",
      previousIntent: "",
      nextIntent: "",
      previousSceneDocument,
      nextSceneDocument,
      currentCodeWorkspace: null
    });

    expect(decision.applied).toBe(false);
    expect(decision.codeWorkspace).toBeNull();
    expect(decision.reason).toContain("analytics");
  });

  test("syncSceneToCodeWorkspace fails closed when a slide has non-string bullets", () => {
    const previousSceneDocument = createEmptySceneDocument({
      artifactId: "artifact_bad_slides",
      kind: "slides"
    });
    const nextSceneDocument = {
      ...previousSceneDocument,
      version: 2,
      nodes: [
        {
          id: "slide_2",
          type: "slide-content",
          name: "Plan",
          props: { bullets: ["ok", 42 as unknown as string] },
          children: []
        }
      ]
    };

    const decision = syncSceneToCodeWorkspace({
      artifactKind: "slides",
      artifactName: "Atlas Deck",
      previousIntent: "",
      nextIntent: "",
      previousSceneDocument,
      nextSceneDocument,
      currentCodeWorkspace: null
    });

    expect(decision.applied).toBe(false);
    expect(decision.reason).toContain("bullets");
  });

  test("prototype scene → code → scene round-trips with mixed node kinds", () => {
    const startingNodes = [
      {
        id: "s_1",
        type: "screen",
        name: "Welcome",
        props: { headline: "Hello", body: "Intro" },
        children: []
      },
      {
        id: "l_1",
        type: "screen-link",
        name: "s_1 → s_2",
        props: { from: "s_1", to: "s_2", trigger: "tap" },
        children: []
      },
      {
        id: "c_1",
        type: "screen-cta",
        name: "Confirm",
        props: {
          headline: "Ready?",
          body: "Confirm to continue.",
          primaryAction: "Go",
          secondaryAction: "Back"
        },
        children: []
      },
      {
        id: "s_2",
        type: "screen",
        name: "Done",
        props: { headline: "Done" },
        children: []
      }
    ];
    const startingScene = {
      ...createEmptySceneDocument({
        artifactId: "artifact_rt",
        kind: "prototype"
      }),
      version: 2,
      nodes: startingNodes
    };

    const emitted = syncSceneToCodeWorkspace({
      artifactKind: "prototype",
      artifactName: "Atlas",
      previousIntent: "",
      nextIntent: "",
      previousSceneDocument: {
        ...startingScene,
        version: 1,
        nodes: []
      },
      nextSceneDocument: startingScene,
      currentCodeWorkspace: null
    });
    expect(emitted.applied).toBe(true);

    // Perturb the scene document so the code→scene sync below produces a
    // genuinely different node set and therefore does not short-circuit on
    // the "already matches" fail-closed branch.
    const parseBack = syncCodeToSceneDocument({
      artifactKind: "prototype",
      currentSceneDocument: {
        ...startingScene,
        version: 3,
        nodes: [
          {
            id: "placeholder",
            type: "screen",
            name: "pending",
            props: {},
            children: []
          }
        ]
      },
      files: emitted.codeWorkspace!.files
    });
    expect(parseBack.applied).toBe(true);
    expect(parseBack.sceneDocument?.nodes).toEqual(startingNodes);
  });

  test("slides scene → code → scene round-trips with bullets preserved", () => {
    const startingNodes = [
      {
        id: "slide_1",
        type: "slide-title",
        name: "Kickoff",
        props: { headline: "Kickoff", body: "Priorities" },
        children: []
      },
      {
        id: "slide_2",
        type: "slide-content",
        name: "Plan",
        props: {
          headline: "Focus",
          body: "Core bets",
          bullets: ["Alpha", "Beta"]
        },
        children: []
      },
      {
        id: "slide_3",
        type: "slide-closing",
        name: "Close",
        props: { headline: "Next", body: "Share deck" },
        children: []
      }
    ];
    const startingScene = {
      ...createEmptySceneDocument({
        artifactId: "artifact_rt_slides",
        kind: "slides"
      }),
      version: 2,
      nodes: startingNodes
    };

    const emitted = syncSceneToCodeWorkspace({
      artifactKind: "slides",
      artifactName: "Atlas Deck",
      previousIntent: "",
      nextIntent: "",
      previousSceneDocument: {
        ...startingScene,
        version: 1,
        nodes: []
      },
      nextSceneDocument: startingScene,
      currentCodeWorkspace: null
    });
    expect(emitted.applied).toBe(true);

    const parseBack = syncCodeToSceneDocument({
      artifactKind: "slides",
      currentSceneDocument: {
        ...startingScene,
        version: 3,
        nodes: [
          {
            id: "placeholder",
            type: "slide-title",
            name: "pending",
            props: {},
            children: []
          }
        ]
      },
      files: emitted.codeWorkspace!.files
    });
    expect(parseBack.applied).toBe(true);
    expect(parseBack.sceneDocument?.nodes).toEqual(startingNodes);
  });
});
