import { describe, expect, test } from "vitest";

import { summarizePackEvidence } from "../src/index";

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
