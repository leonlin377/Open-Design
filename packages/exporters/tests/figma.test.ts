import { describe, expect, test } from "vitest";
import type { SceneDocument } from "@opendesign/contracts";
import { buildFigmaImportExport } from "../src/figma";

function makeWebsiteScene(): SceneDocument {
  return {
    id: "scene_1",
    artifactId: "artifact_1",
    kind: "website",
    version: 3,
    nodes: [
      {
        id: "hero",
        type: "section",
        name: "Hero Section",
        props: {
          template: "hero",
          eyebrow: "Launch Surface",
          headline: "Atlas leads with cinematic hierarchy.",
          body: "Cinematic launch experience."
        },
        children: []
      },
      {
        id: "grid",
        type: "section",
        name: "Feature Grid",
        props: {
          template: "feature-grid",
          title: "System lanes",
          items: [
            { label: "Scene", body: "Scene stays versioned." },
            { label: "Design", body: "Brand rhythm attached." },
            { label: "Export", body: "Export derives from scene." }
          ]
        },
        children: []
      }
    ],
    metadata: {}
  };
}

function makePrototypeScene(): SceneDocument {
  return {
    id: "scene_p",
    artifactId: "artifact_p",
    kind: "prototype",
    version: 2,
    nodes: [
      {
        id: "screen_1",
        type: "screen",
        name: "Welcome",
        props: {
          eyebrow: "Flow Surface",
          headline: "Welcome aboard",
          body: "Sign in to continue"
        },
        children: []
      },
      {
        id: "screen_2",
        type: "screen",
        name: "Confirm",
        props: {
          eyebrow: "Flow Surface",
          headline: "Confirm your email",
          body: "We sent a code."
        },
        children: []
      },
      {
        id: "link_1",
        type: "screen-link",
        name: "Welcome → Confirm",
        props: {
          from: "screen_1",
          to: "screen_2",
          trigger: "tap"
        },
        children: []
      }
    ],
    metadata: {}
  };
}

function makeSlidesScene(): SceneDocument {
  return {
    id: "scene_s",
    artifactId: "artifact_s",
    kind: "slides",
    version: 1,
    nodes: [
      {
        id: "slide_1",
        type: "slide-title",
        name: "Opening",
        props: {
          eyebrow: "Deck Surface",
          headline: "Atlas narrates release",
          body: "Q4 review"
        },
        children: []
      },
      {
        id: "slide_2",
        type: "slide-content",
        name: "Agenda",
        props: {
          title: "Agenda",
          bullets: ["Goals", "Outcomes", "Asks"]
        },
        children: []
      }
    ],
    metadata: {}
  };
}

describe("buildFigmaImportExport", () => {
  test("builds a FILE-shaped document for a website artifact", () => {
    const out = buildFigmaImportExport({
      artifact: {
        id: "artifact_1",
        name: "Atlas Website",
        kind: "website"
      },
      sceneDocument: makeWebsiteScene(),
      prompt: "Launch the new Atlas surface."
    });

    expect(out.schemaVersion).toBe(1);
    expect(out.document.type).toBe("DOCUMENT");
    expect(out.document.children).toHaveLength(1);
    const canvas = out.document.children[0]!;
    expect(canvas.type).toBe("CANVAS");
    expect(canvas.children).toHaveLength(2);

    const hero = canvas.children[0]!;
    expect(hero.type).toBe("FRAME");
    // Desktop frame dimensions for websites.
    expect(hero.absoluteBoundingBox.width).toBe(1440);
    expect(hero.absoluteBoundingBox.height).toBe(900);

    // Child text nodes are present and typed TEXT with an `absoluteBoundingBox`.
    const textChild = hero.children.find((child) => child.type === "TEXT");
    expect(textChild).toBeDefined();
    expect(textChild!.absoluteBoundingBox.width).toBeGreaterThan(0);

    // nodeIndex is searchable.
    expect(out.nodeIndex[canvas.id]).toBe(canvas);
    expect(out.nodeIndex[hero.id]).toBe(hero);

    // JSON serializable round-trip.
    const roundTripped = JSON.parse(JSON.stringify(out));
    expect(roundTripped.document.children[0].type).toBe("CANVAS");
  });

  test("uses iPhone-sized frames for prototypes and emits flow starting points", () => {
    const out = buildFigmaImportExport({
      artifact: {
        id: "artifact_p",
        name: "Atlas Prototype",
        kind: "prototype"
      },
      sceneDocument: makePrototypeScene()
    });

    const canvas = out.document.children[0]!;
    // Prototype frames skip the screen-link transition, keeping only the 2 screens.
    expect(canvas.children).toHaveLength(2);
    const [firstFrame] = canvas.children;
    expect(firstFrame!.absoluteBoundingBox.width).toBe(393);
    expect(firstFrame!.absoluteBoundingBox.height).toBe(852);

    expect(canvas.prototypeStartNodeID).toBe(firstFrame!.id);
    expect(canvas.flowStartingPoints).toHaveLength(1);
  });

  test("uses 16:9 slide frames for slides artifacts", () => {
    const out = buildFigmaImportExport({
      artifact: {
        id: "artifact_s",
        name: "Atlas Deck",
        kind: "slides"
      },
      sceneDocument: makeSlidesScene()
    });

    const canvas = out.document.children[0]!;
    expect(canvas.children).toHaveLength(2);
    const firstFrame = canvas.children[0]!;
    expect(firstFrame.absoluteBoundingBox.width).toBe(1920);
    expect(firstFrame.absoluteBoundingBox.height).toBe(1080);
    // Slides do not imply a prototype start.
    expect(canvas.prototypeStartNodeID).toBeNull();
  });

  test("accepts a theme override and maps CSS hex into RGBA fills", () => {
    const out = buildFigmaImportExport({
      artifact: {
        id: "artifact_1",
        name: "Atlas",
        kind: "website"
      },
      sceneDocument: makeWebsiteScene(),
      theme: {
        surface: "#112233",
        accent: "#ff0000",
        text: "#000000"
      }
    });

    const firstFrame = out.document.children[0]!.children[0]!;
    expect(firstFrame.fills).toHaveLength(1);
    const fill = firstFrame.fills[0]!;
    // 0x11 / 0xff ≈ 0.0667 — check rough bounds, not exact FP values.
    expect(fill.color.r).toBeCloseTo(0x11 / 0xff, 3);
    expect(fill.color.g).toBeCloseTo(0x22 / 0xff, 3);
    expect(fill.color.b).toBeCloseTo(0x33 / 0xff, 3);
  });

  test("falls back to a seed frame when scene is empty", () => {
    const out = buildFigmaImportExport({
      artifact: {
        id: "artifact_x",
        name: "Atlas",
        kind: "website"
      },
      sceneDocument: {
        id: "scene_empty",
        artifactId: "artifact_x",
        kind: "website",
        version: 1,
        nodes: [],
        metadata: {}
      },
      prompt: "Seed me"
    });

    const canvas = out.document.children[0]!;
    expect(canvas.children).toHaveLength(1);
    expect(canvas.children[0]!.name).toContain("Seed");
  });
});
