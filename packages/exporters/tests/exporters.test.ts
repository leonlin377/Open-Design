import { describe, expect, test } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import {
  buildArtifactHtmlExport,
  buildArtifactHandoffArchive,
  buildArtifactHandoffBundle,
  buildPrototypeFlowExport,
  buildSlidesDeckExport,
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

  test("renders a prototype flow storyboard from prototype screens", () => {
    const bundle = buildArtifactHtmlExport({
      artifactName: "Atlas Prototype",
      prompt: "Map a mobile checkout flow.",
      sceneDocument: {
        id: "scene_proto",
        artifactId: "artifact_proto",
        kind: "prototype",
        version: 3,
        nodes: [
          {
            id: "screen_1",
            type: "screen",
            name: "Welcome Screen",
            props: {
              template: "hero",
              eyebrow: "Flow Surface",
              headline: "Start the checkout flow.",
              body: "Lead users into a focused mobile handoff."
            },
            children: []
          },
          {
            id: "screen_2",
            type: "screen",
            name: "Offer Screen",
            props: {
              template: "cta",
              headline: "Confirm the selected plan.",
              body: "Guide the user into the final confirmation step.",
              primaryAction: "Continue",
              secondaryAction: "Back"
            },
            children: []
          }
        ],
        metadata: {}
      }
    });

    expect(bundle.html).toContain("Prototype Flow");
    expect(bundle.html).toContain("Welcome Screen");
    expect(bundle.html).toContain("Offer Screen");
    expect(bundle.html).toContain("Screen 1");
  });

  test("renders a slides deck storyboard from slide nodes", () => {
    const bundle = buildArtifactHtmlExport({
      artifactName: "Atlas Deck",
      prompt: "Summarize the board update.",
      sceneDocument: {
        id: "scene_slides",
        artifactId: "artifact_slides",
        kind: "slides",
        version: 3,
        nodes: [
          {
            id: "slide_1",
            type: "slide",
            name: "Title Slide",
            props: {
              template: "hero",
              eyebrow: "Deck Surface",
              headline: "Atlas Q2 board update.",
              body: "Open with the highest-signal company narrative."
            },
            children: []
          },
          {
            id: "slide_2",
            type: "slide",
            name: "System Slide",
            props: {
              template: "feature-grid",
              title: "Operating system lanes",
              items: [
                {
                  label: "Revenue",
                  body: "Revenue quality remained ahead of plan."
                },
                {
                  label: "Product",
                  body: "Core activation loops held steady."
                },
                {
                  label: "Outlook",
                  body: "The next quarter needs sharper focus."
                }
              ]
            },
            children: []
          }
        ],
        metadata: {}
      }
    });

    expect(bundle.html).toContain("Slides Deck");
    expect(bundle.html).toContain("Title Slide");
    expect(bundle.html).toContain("Slide 1");
    expect(bundle.html).toContain("Atlas Q2 board update.");
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

  test("renders a navigable prototype source bundle from prototype screens", () => {
    const bundle = buildArtifactSourceBundle({
      artifactKind: "prototype",
      artifactName: "Atlas Prototype",
      prompt: "Map a mobile checkout flow.",
      sceneNodes: [
        {
          id: "screen_1",
          type: "screen",
          name: "Welcome Screen",
          props: {
            template: "hero",
            eyebrow: "Flow Surface",
            headline: "Start the checkout flow.",
            body: "Lead users into a focused mobile handoff."
          },
          children: []
        },
        {
          id: "screen_2",
          type: "screen",
          name: "Offer Screen",
          props: {
            template: "cta",
            headline: "Confirm the selected plan.",
            body: "Guide the user into the final confirmation step."
          },
          children: []
        }
      ]
    });

    expect(bundle.files["/App.tsx"]).toContain("useState");
    expect(bundle.files["/App.tsx"]).toContain("Prototype Flow");
    expect(bundle.files["/App.tsx"]).toContain("Next Screen");
    expect(bundle.files["/App.tsx"]).toContain("Welcome Screen");
  });

  test("renders a navigable slides source bundle from slide nodes", () => {
    const bundle = buildArtifactSourceBundle({
      artifactKind: "slides",
      artifactName: "Atlas Deck",
      prompt: "Summarize the board update.",
      sceneNodes: [
        {
          id: "slide_1",
          type: "slide",
          name: "Title Slide",
          props: {
            template: "hero",
            eyebrow: "Deck Surface",
            headline: "Atlas Q2 board update.",
            body: "Open with the highest-signal company narrative."
          },
          children: []
        },
        {
          id: "slide_2",
          type: "slide",
          name: "System Slide",
          props: {
            template: "cta",
            headline: "Next actions for the board.",
            body: "Close with operating priorities and asks."
          },
          children: []
        }
      ]
    });

    expect(bundle.files["/App.tsx"]).toContain("useState");
    expect(bundle.files["/App.tsx"]).toContain("Slides Deck");
    expect(bundle.files["/App.tsx"]).toContain("Next Slide");
    expect(bundle.files["/App.tsx"]).toContain("Title Slide");
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

describe("buildArtifactHandoffBundle", () => {
  test("packages workspace metadata, review context, and saved source files", () => {
    const bundle = buildArtifactHandoffBundle({
      project: {
        id: "project_1",
        name: "Atlas Project",
        ownerUserId: null,
        createdAt: "2026-04-19T09:00:00.000Z",
        updatedAt: "2026-04-19T11:00:00.000Z"
      },
      artifact: {
        id: "artifact_1",
        projectId: "project_1",
        name: "Atlas Website",
        kind: "website",
        createdAt: "2026-04-19T09:10:00.000Z",
        updatedAt: "2026-04-19T11:05:00.000Z"
      },
      workspace: {
        artifactId: "artifact_1",
        intent: "Prepare a review-ready launch page.",
        activeVersionId: "version_2",
        sceneDocument: {
          id: "scene_handoff",
          artifactId: "artifact_1",
          kind: "website",
          version: 3,
          nodes: [
            {
              id: "hero_1",
              type: "section",
              name: "Hero Section",
              props: {
                template: "hero",
                headline: "Atlas review handoff."
              },
              children: []
            }
          ],
          metadata: {}
        },
        codeWorkspace: {
          files: {
            "/App.tsx": "export default function App() { return <main>Saved handoff code</main>; }"
          },
          baseSceneVersion: 3,
          updatedAt: "2026-04-19T11:06:00.000Z"
        },
        syncPlan: {
          mode: "constrained",
          reason: "Scene remains the source of truth.",
          sourceMode: "scene",
          targetMode: "code-supported",
          changeScope: "document"
        },
        versionCount: 2,
        openCommentCount: 1,
        updatedAt: "2026-04-19T11:06:00.000Z"
      },
      versions: [
        {
          id: "version_2",
          artifactId: "artifact_1",
          label: "Review 2",
          summary: "Latest handoff checkpoint",
          source: "manual",
          sceneVersion: 3,
          hasCodeWorkspaceSnapshot: true,
          createdAt: "2026-04-19T11:06:00.000Z"
        },
        {
          id: "version_1",
          artifactId: "artifact_1",
          label: "Seed",
          summary: "Initial seed",
          source: "seed",
          sceneVersion: 1,
          hasCodeWorkspaceSnapshot: false,
          createdAt: "2026-04-19T09:10:00.000Z"
        }
      ],
      comments: [
        {
          id: "comment_1",
          artifactId: "artifact_1",
          body: "Tighten the hero copy.",
          status: "open",
          anchor: {
            selectionPath: ["root", "hero_1"]
          },
          createdAt: "2026-04-19T10:00:00.000Z",
          updatedAt: "2026-04-19T10:00:00.000Z"
        },
        {
          id: "comment_2",
          artifactId: "artifact_1",
          body: "Footer note resolved.",
          status: "resolved",
          anchor: {
            viewport: {
              x: 10,
              y: 20,
              width: 300,
              height: 120
            }
          },
          createdAt: "2026-04-19T10:10:00.000Z",
          updatedAt: "2026-04-19T10:15:00.000Z"
        }
      ]
    });

    expect(bundle.filenameBase).toBe("atlas-website");
    expect(bundle.manifest.comments).toEqual({
      total: 2,
      open: 1,
      resolved: 1
    });
    expect(bundle.manifest.workspace).toMatchObject({
      sceneVersion: 3,
      hasCodeWorkspace: true,
      codeFileCount: 1
    });
    expect(bundle.manifest.exports.structured).toBeNull();
    expect(bundle.files["/exports/source/App.tsx"]).toContain("Saved handoff code");
    expect(bundle.files["/exports/atlas-website.html"]).toContain("<!doctype html>");
    expect(bundle.files["/README.md"]).toContain("saved code workspace");
  });

  test("includes artifact-specific structured exports and archive packaging", () => {
    const bundle = buildArtifactHandoffBundle({
      project: {
        id: "project_proto",
        name: "Atlas Prototype Project",
        ownerUserId: null,
        createdAt: "2026-04-19T09:00:00.000Z",
        updatedAt: "2026-04-19T09:30:00.000Z"
      },
      artifact: {
        id: "artifact_proto",
        projectId: "project_proto",
        name: "Atlas Prototype",
        kind: "prototype",
        createdAt: "2026-04-19T09:05:00.000Z",
        updatedAt: "2026-04-19T09:35:00.000Z"
      },
      workspace: {
        artifactId: "artifact_proto",
        intent: "Map the mobile checkout flow.",
        activeVersionId: "version_proto_1",
        sceneDocument: {
          id: "scene_proto_handoff",
          artifactId: "artifact_proto",
          kind: "prototype",
          version: 2,
          nodes: [
            {
              id: "screen_1",
              type: "screen",
              name: "Welcome Screen",
              props: {
                template: "hero",
                headline: "Start the checkout flow."
              },
              children: []
            },
            {
              id: "screen_2",
              type: "screen",
              name: "Confirm Screen",
              props: {
                template: "cta",
                headline: "Confirm the selected plan."
              },
              children: []
            }
          ],
          metadata: {}
        },
        codeWorkspace: null,
        syncPlan: {
          mode: "constrained",
          reason: "Prototype scene stays canonical.",
          sourceMode: "scene",
          targetMode: "code-advanced",
          changeScope: "document"
        },
        versionCount: 1,
        openCommentCount: 0,
        updatedAt: "2026-04-19T09:35:00.000Z"
      },
      versions: [
        {
          id: "version_proto_1",
          artifactId: "artifact_proto",
          label: "Flow Review",
          summary: "Prototype handoff checkpoint",
          source: "manual",
          sceneVersion: 2,
          hasCodeWorkspaceSnapshot: false,
          createdAt: "2026-04-19T09:35:00.000Z"
        }
      ],
      comments: []
    });

    expect(bundle.manifest.exports.structured).toMatchObject({
      path: "/exports/prototype-flow.json",
      kind: "prototype-flow"
    });
    expect(bundle.files["/exports/prototype-flow.json"]).toContain('"artifactKind": "prototype"');

    const archive = buildArtifactHandoffArchive(bundle);
    const unzipped = unzipSync(archive.bytes);

    expect(archive.filename).toBe("atlas-prototype-handoff.zip");
    expect(strFromU8(unzipped["atlas-prototype-handoff/manifest.json"]!)).toContain(
      '"kind": "prototype"'
    );
    expect(
      strFromU8(unzipped["atlas-prototype-handoff/exports/prototype-flow.json"]!)
    ).toContain('"startScreenId": "screen_1"');
  });
});

describe("artifact-specific structured exports", () => {
  test("builds a prototype flow manifest with sequential screen links", () => {
    const bundle = buildPrototypeFlowExport({
      artifactName: "Atlas Prototype",
      prompt: "Map a mobile checkout flow.",
      sceneDocument: {
        id: "scene_proto_export",
        artifactId: "artifact_proto_export",
        kind: "prototype",
        version: 2,
        nodes: [
          {
            id: "screen_1",
            type: "screen",
            name: "Welcome Screen",
            props: {
              template: "hero",
              headline: "Start the checkout flow."
            },
            children: []
          },
          {
            id: "screen_2",
            type: "screen",
            name: "Confirm Screen",
            props: {
              template: "cta",
              headline: "Confirm the selected plan."
            },
            children: []
          }
        ],
        metadata: {}
      }
    });

    expect(bundle.artifactKind).toBe("prototype");
    expect(bundle.startScreenId).toBe("screen_1");
    expect(bundle.screens).toHaveLength(2);
    expect(bundle.screens[0]).toMatchObject({
      id: "screen_1",
      nextScreenId: "screen_2",
      previousScreenId: null
    });
    expect(bundle.screens[1]).toMatchObject({
      id: "screen_2",
      nextScreenId: null,
      previousScreenId: "screen_1"
    });
  });

  test("builds a slides deck manifest with numbered slides", () => {
    const bundle = buildSlidesDeckExport({
      artifactName: "Atlas Deck",
      prompt: "Summarize the board update.",
      sceneDocument: {
        id: "scene_slides_export",
        artifactId: "artifact_slides_export",
        kind: "slides",
        version: 2,
        nodes: [
          {
            id: "slide_1",
            type: "slide",
            name: "Title Slide",
            props: {
              template: "hero",
              headline: "Atlas Q2 board update."
            },
            children: []
          },
          {
            id: "slide_2",
            type: "slide",
            name: "System Slide",
            props: {
              template: "feature-grid",
              title: "Operating system lanes"
            },
            children: []
          }
        ],
        metadata: {}
      }
    });

    expect(bundle.artifactKind).toBe("slides");
    expect(bundle.aspectRatio).toBe("16:9");
    expect(bundle.slides).toHaveLength(2);
    expect(bundle.slides[0]).toMatchObject({
      id: "slide_1",
      slideNumber: 1
    });
    expect(bundle.slides[1]).toMatchObject({
      id: "slide_2",
      slideNumber: 2
    });
  });
});
