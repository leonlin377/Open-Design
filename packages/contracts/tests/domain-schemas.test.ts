import { describe, expect, test } from "vitest";

import {
  ArtifactCommentSchema,
  ArtifactKindSchema,
  ArtifactVersionSnapshotSchema,
  ArtifactWorkspaceSchema,
  CommentAnchorSchema,
  DesignSystemPackSchema,
  SceneTemplateKindSchema,
  SceneDocumentSchema
} from "../src/index";

describe("ArtifactKindSchema", () => {
  test("accepts the three supported artifact kinds", () => {
    expect(ArtifactKindSchema.parse("website")).toBe("website");
    expect(ArtifactKindSchema.parse("prototype")).toBe("prototype");
    expect(ArtifactKindSchema.parse("slides")).toBe("slides");
  });

  test("rejects unsupported artifact kinds", () => {
    expect(() => ArtifactKindSchema.parse("figma")).toThrowError();
  });
});

describe("SceneTemplateKindSchema", () => {
  test("accepts supported section templates", () => {
    expect(SceneTemplateKindSchema.parse("hero")).toBe("hero");
    expect(SceneTemplateKindSchema.parse("feature-grid")).toBe("feature-grid");
    expect(SceneTemplateKindSchema.parse("cta")).toBe("cta");
  });
});

describe("SceneDocumentSchema", () => {
  test("accepts a nested scene document with metadata", () => {
    const scene = SceneDocumentSchema.parse({
      id: "scene_1",
      artifactId: "artifact_1",
      kind: "website",
      version: 3,
      nodes: [
        {
          id: "root",
          type: "frame",
          name: "Root Frame",
          props: {
            direction: "vertical"
          },
          children: [
            {
              id: "hero",
              type: "section",
              name: "Hero",
              props: {
                headline: "OpenDesign"
              },
              children: []
            }
          ]
        }
      ],
      metadata: {
        themeId: "theme_default",
        designSystemPackId: "dsp_1"
      }
    });

    expect(scene.nodes[0]?.children[0]?.id).toBe("hero");
    expect(scene.metadata.designSystemPackId).toBe("dsp_1");
  });
});

describe("CommentAnchorSchema", () => {
  test("requires at least one anchoring strategy", () => {
    expect(() =>
      CommentAnchorSchema.parse({
        selectionPath: [],
        viewport: null
      })
    ).toThrowError(/anchor/i);
  });

  test("accepts element and viewport anchors together", () => {
    const anchor = CommentAnchorSchema.parse({
      elementId: "hero",
      selectionPath: ["root", "hero"],
      viewport: {
        x: 20,
        y: 40,
        width: 320,
        height: 200
      }
    });

    expect(anchor.elementId).toBe("hero");
  });
});

describe("DesignSystemPackSchema", () => {
  test("keeps provenance for inferred tokens and motifs", () => {
    const pack = DesignSystemPackSchema.parse({
      id: "dsp_1",
      name: "Acme Brand",
      source: "github",
      tokens: {
        colors: {
          primary: "#101828"
        },
        typography: {
          display: "Sora"
        }
      },
      components: [
        {
          id: "button-primary",
          name: "Primary Button",
          category: "button",
          signature: "rounded filled"
        }
      ],
      motifs: [
        {
          id: "motif_1",
          label: "Dense hero layering",
          description: "Layered typography over gradients"
        }
      ],
      provenance: [
        {
          id: "prov_1",
          type: "screenshot",
          sourceRef: "https://example.com",
          targets: ["tokens.colors.primary", "motifs.motif_1"]
        }
      ]
    });

    expect(pack.provenance[0]?.targets).toContain("tokens.colors.primary");
  });
});

describe("ArtifactVersionSnapshotSchema", () => {
  test("accepts persisted version metadata", () => {
    const version = ArtifactVersionSnapshotSchema.parse({
      id: "version_1",
      artifactId: "artifact_1",
      label: "V1 Seed",
      summary: "Initial seeded workspace snapshot",
      source: "seed",
      sceneVersion: 1,
      createdAt: "2026-04-18T09:00:00.000Z"
    });

    expect(version.source).toBe("seed");
    expect(version.sceneVersion).toBe(1);
  });
});

describe("ArtifactCommentSchema", () => {
  test("accepts anchored open comments", () => {
    const comment = ArtifactCommentSchema.parse({
      id: "comment_1",
      artifactId: "artifact_1",
      body: "Tighten the left rail spacing and push the eyebrow upward.",
      status: "open",
      anchor: {
        elementId: "hero",
        selectionPath: ["root", "hero"]
      },
      createdAt: "2026-04-18T09:10:00.000Z",
      updatedAt: "2026-04-18T09:10:00.000Z"
    });

    expect(comment.anchor.elementId).toBe("hero");
    expect(comment.status).toBe("open");
  });
});

describe("ArtifactWorkspaceSchema", () => {
  test("accepts workspace overview payloads", () => {
    const workspace = ArtifactWorkspaceSchema.parse({
      artifactId: "artifact_1",
      intent: "Build a cinematic artifact shell with bold type and an export-ready inspector.",
      activeVersionId: "version_2",
      sceneDocument: {
        id: "scene_1",
        artifactId: "artifact_1",
        kind: "website",
        version: 2,
        nodes: [],
        metadata: {}
      },
      syncPlan: {
        mode: "full",
        reason: "Scene edits can still round-trip into supported code.",
        sourceMode: "scene",
        targetMode: "code-supported",
        changeScope: "document"
      },
      versionCount: 2,
      openCommentCount: 1,
      updatedAt: "2026-04-18T09:15:00.000Z"
    });

    expect(workspace.syncPlan.mode).toBe("full");
    expect(workspace.versionCount).toBe(2);
  });
});
