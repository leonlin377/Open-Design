import { describe, expect, test } from "vitest";

import {
  extractDesignSystemPackFromRepositoryFiles,
  summarizePackEvidence
} from "../src/index";

describe("summarizePackEvidence", () => {
  test("summarizes evidence sources and total target coverage", () => {
    const summary = summarizePackEvidence({
      pack: {
        id: "pack_1",
        name: "Brand",
        source: "site-capture",
        tokens: {
          colors: {
            primary: "#0f172a"
          },
          typography: {}
        },
        components: [],
        motifs: [],
        provenance: [
          {
            id: "prov_1",
            type: "screenshot",
            sourceRef: "https://example.com",
            targets: ["tokens.colors.primary"]
          },
          {
            id: "prov_2",
            type: "dom",
            sourceRef: "https://example.com/home",
            targets: ["layout.hero", "layout.footer"]
          }
        ]
      },
      evidence: [
        {
          label: "Homepage screenshot",
          kind: "screenshot",
          sourceRef: "https://example.com"
        },
        {
          label: "DOM capture",
          kind: "dom",
          sourceRef: "https://example.com/home"
        }
      ]
    });

    expect(summary).toEqual({
      evidenceCount: 2,
      provenanceCount: 2,
      targetCount: 3,
      sourceKinds: ["dom", "screenshot"]
    });
  });
});

describe("extractDesignSystemPackFromRepositoryFiles", () => {
  test("extracts token and component evidence from repository text files", () => {
    const result = extractDesignSystemPackFromRepositoryFiles({
      source: {
        type: "github",
        owner: "acme",
        repo: "design-system",
        ref: "main"
      },
      files: [
        {
          path: "packages/tokens/colors.css",
          content: `
            :root {
              --color-primary: #0f172a;
              --font-size-display: 64px;
            }
          `
        },
        {
          path: "packages/tokens/theme.json",
          content: JSON.stringify({
            colors: {
              accent: "#14b8a6"
            },
            typography: {
              body: {
                fontFamily: "Avenir Next"
              }
            }
          })
        },
        {
          path: "src/components/button.tsx",
          content: "export function Button() { return <button />; }"
        }
      ]
    });

    expect(result.pack.source).toBe("github");
    expect(result.pack.tokens.colors).toMatchObject({
      "color.primary": "#0f172a",
      "colors.accent": "#14b8a6"
    });
    expect(result.pack.tokens.typography).toMatchObject({
      "font.size.display": "64px",
      "typography.body.fontfamily": "Avenir Next"
    });
    expect(result.pack.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Button",
          signature: "src/components/button.tsx"
        })
      ])
    );
    expect(result.pack.motifs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "motif_color_system" }),
        expect.objectContaining({ id: "motif_type_scale" }),
        expect.objectContaining({ id: "motif_component_library" })
      ])
    );
    expect(result.evidence).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });

  test("warns when repository files do not contain recognizable design evidence", () => {
    const result = extractDesignSystemPackFromRepositoryFiles({
      source: {
        type: "github",
        owner: "acme",
        repo: "service",
        ref: "main"
      },
      files: [
        {
          path: "README.md",
          content: "# Service"
        }
      ]
    });

    expect(result.pack.tokens.colors).toEqual({});
    expect(result.pack.components).toEqual([]);
    expect(result.warnings[0]).toMatch(/no obvious tokens or component entry points/i);
  });
});
