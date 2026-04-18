import { describe, expect, test } from "vitest";

import {
  extractDesignSystemPackFromRepositoryFiles,
  extractDesignSystemPackFromSiteCapture,
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

  test("supports local-directory sources and derives a pack name from the directory path", () => {
    const result = extractDesignSystemPackFromRepositoryFiles({
      source: {
        type: "local-directory",
        absolutePath: "/Users/leon/design-systems/atlas-ui"
      },
      files: [
        {
          path: "tokens/theme.json",
          content: JSON.stringify({
            colors: {
              primary: "#111827"
            }
          })
        }
      ]
    });

    expect(result.pack).toMatchObject({
      name: "atlas-ui",
      source: "local-directory",
      tokens: {
        colors: {
          "colors.primary": "#111827"
        }
      }
    });
  });

  test("extracts tokens and component signatures from captured site data", () => {
    const result = extractDesignSystemPackFromSiteCapture({
      source: {
        type: "site-capture",
        url: "https://atlas.example.com"
      },
      html: `
        <html>
          <head>
            <style>
              :root { --color-primary: #0f172a; }
              h1 { font-size: 72px; }
            </style>
          </head>
          <body>
            <header class="masthead"></header>
            <button class="cta-button">Launch</button>
          </body>
        </html>
      `,
      stylesheets: [
        {
          sourceRef: "https://atlas.example.com/styles.css",
          content: ".hero { font-family: Avenir Next; }"
        }
      ],
      domNodes: [
        {
          tag: "header",
          className: "masthead",
          text: null
        },
        {
          tag: "button",
          className: "cta-button",
          text: "Launch"
        }
      ]
    });

    expect(result.pack).toMatchObject({
      name: "atlas.example.com",
      source: "site-capture",
      tokens: {
        colors: {
          "color.primary": "#0f172a"
        }
      }
    });
    expect(result.pack.tokens.typography).toEqual(
      expect.objectContaining({
        "font.family.avenir.next": "Avenir Next",
        "font.size.72px": "72px"
      })
    );
    expect(result.pack.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signature: "button.cta-button"
        }),
        expect.objectContaining({
          signature: "header.masthead"
        })
      ])
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "dom",
          sourceRef: "https://atlas.example.com"
        })
      ])
    );
  });
});
