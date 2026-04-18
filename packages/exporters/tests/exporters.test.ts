import { describe, expect, test } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import {
  buildArtifactHtmlExport,
  buildArtifactSourceArchive,
  buildArtifactSourceBundle,
  buildHandoffManifestSummary
} from "../src/index";

describe("buildHandoffManifestSummary", () => {
  test("summarizes exported artifacts by kind and byte size", () => {
    const summary = buildHandoffManifestSummary([
      {
        id: "artifact-1",
        kind: "website",
        label: "Landing Page",
        updatedAt: "2026-04-18T10:00:00.000Z",
        sizeBytes: 1200
      },
      {
        id: "artifact-2",
        kind: "slides",
        label: "Board Deck",
        updatedAt: "2026-04-18T11:00:00.000Z",
        sizeBytes: 800
      }
    ]);

    expect(summary).toEqual({
      artifactCount: 2,
      byKind: {
        website: 1,
        prototype: 0,
        slides: 1
      },
      latestUpdatedAt: "2026-04-18T11:00:00.000Z",
      totalBytes: 2000
    });
  });
});

describe("buildArtifactHtmlExport", () => {
  test("renders hero, feature-grid, and cta sections into an html document", () => {
    const bundle = buildArtifactHtmlExport({
      artifactName: "Atlas Website",
      prompt: "Build a cinematic launch experience.",
      sceneDocument: {
        id: "scene_1",
        artifactId: "artifact_1",
        kind: "website",
        version: 4,
        nodes: [
          {
            id: "hero_1",
            type: "section",
            name: "Hero Section",
            props: {
              template: "hero",
              eyebrow: "Launch Surface",
              headline: "Atlas leads with cinematic hierarchy.",
              body: "Build a cinematic launch experience."
            },
            children: []
          },
          {
            id: "grid_1",
            type: "section",
            name: "Feature Grid",
            props: {
              template: "feature-grid",
              title: "System lanes",
              items: [
                {
                  label: "Scene",
                  body: "Scene edits stay structured."
                },
                {
                  label: "Design",
                  body: "Design motifs stay portable."
                },
                {
                  label: "Export",
                  body: "Exports stay aligned."
                }
              ]
            },
            children: []
          },
          {
            id: "cta_1",
            type: "section",
            name: "Call To Action",
            props: {
              template: "cta",
              headline: "Ready for export?",
              body: "Create a snapshot and export the bundle.",
              primaryAction: "Create Snapshot",
              secondaryAction: "Export Handoff"
            },
            children: []
          }
        ],
        metadata: {}
      }
    });

    expect(bundle.filename).toBe("atlas-website.html");
    expect(bundle.html).toContain("<!doctype html>");
    expect(bundle.html).toContain("Atlas leads with cinematic hierarchy.");
    expect(bundle.html).toContain("System lanes");
    expect(bundle.html).toContain("Ready for export?");
  });

  test("seeds hero content and feature defaults when the scene is empty", () => {
    const bundle = buildArtifactHtmlExport({
      artifactName: "Seed Artifact",
      prompt: "Shape the first review-ready section.",
      sceneDocument: {
        id: "scene_empty",
        artifactId: "artifact_empty",
        kind: "website",
        version: 1,
        nodes: [],
        metadata: {}
      }
    });

    expect(bundle.html).toContain("Seed Artifact is ready for the first scene section.");
    expect(bundle.html).toContain("Shape the first review-ready section.");
  });
});

describe("buildArtifactSourceBundle", () => {
  test("renders a reusable runnable source bundle from scene nodes", () => {
    const bundle = buildArtifactSourceBundle({
      artifactKind: "website",
      artifactName: "Atlas Website",
      prompt: "Build a cinematic launch experience.",
      sceneNodes: [
        {
          id: "hero_1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            eyebrow: "Launch Surface",
            headline: "Atlas leads with cinematic hierarchy.",
            body: "Build a cinematic launch experience."
          },
          children: []
        }
      ]
    });

    expect(bundle.filenameBase).toBe("atlas-website");
    expect(bundle.files["/App.tsx"]).toContain("Atlas leads with cinematic hierarchy.");
    expect(bundle.files["/styles.css"]).toContain(".hero");
    expect(bundle.files["/package.json"]).toContain('"vite"');
    expect(bundle.files["/main.tsx"]).toContain('import App from "./App"');
    expect(bundle.files["/index.html"]).toContain("<div id=\"root\"></div>");
    expect(bundle.files["/README.md"]).toContain("npm run dev");
    expect(bundle.files["/opendesign.sync.json"]).toContain('"version": 1');
    expect(bundle.files["/opendesign.sync.json"]).toContain('"template": "hero"');
  });
});

describe("buildArtifactSourceArchive", () => {
  test("packages the generated source bundle as a zip archive", () => {
    const bundle = buildArtifactSourceBundle({
      artifactKind: "website",
      artifactName: "Atlas Website",
      prompt: "Build a cinematic launch experience.",
      sceneNodes: []
    });
    const archive = buildArtifactSourceArchive(bundle);
    const unzipped = unzipSync(archive.bytes);

    expect(archive.filename).toBe("atlas-website-source.zip");
    expect(strFromU8(unzipped["atlas-website/package.json"]!)).toContain('"vite"');
    expect(strFromU8(unzipped["atlas-website/main.tsx"]!)).toContain(
      'import App from "./App"'
    );
    expect(strFromU8(unzipped["atlas-website/App.tsx"]!)).toContain(
      "Atlas Website is ready for the first scene section."
    );
  });
});
