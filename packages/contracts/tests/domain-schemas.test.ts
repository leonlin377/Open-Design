import { describe, expect, test } from "vitest";

import {
  ArtifactKindSchema,
  CommentAnchorSchema,
  DesignSystemPackSchema,
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
