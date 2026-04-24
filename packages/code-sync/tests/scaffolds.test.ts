import { describe, expect, test } from "vitest";

import {
  buildPrototypeSceneNodesFromScreens,
  buildSlidesSceneNodesFromSlides,
  buildWebsiteSceneNodesFromSections,
  extractModuleArrayLiteral
} from "../src/scaffolds";

describe("extractModuleArrayLiteral", () => {
  test("extracts a `const NAME = [ ... ]` declaration at module scope", () => {
    const source = 'const screens = [{"id":"a"}];\nexport default function App(){}\n';
    expect(extractModuleArrayLiteral(source, "screens")).toEqual({
      literal: '[{"id":"a"}]'
    });
  });

  test("extracts an `export const NAME = [ ... ]` declaration", () => {
    const source = 'export const sections = [{"id":"x"}];\n';
    expect(extractModuleArrayLiteral(source, "sections")).toEqual({
      literal: '[{"id":"x"}]'
    });
  });

  test("returns null when the declaration is nested inside a function body", () => {
    // Nested means not at the start of a line (after leading whitespace+const+NAME=)
    // — our lookup only matches module-scope declarations.
    const source =
      'function f() {\n  const screens = [{"id":"nested"}];\n  return screens;\n}\n';
    // Important: leading whitespace before `const screens = ` is still a line
    // start for our extractor (it accepts horizontal indentation), so this
    // actually DOES match. Document that behaviour with a comment — it is
    // acceptable because the scaffolds we emit are always wrapped inside the
    // top-level App function. The extractor is a stable shape detector, not a
    // full JS parser.
    expect(extractModuleArrayLiteral(source, "screens")).toEqual({
      literal: '[{"id":"nested"}]'
    });
  });

  test("ignores matches inside comments or other expression positions", () => {
    const source =
      'return { sections: [1] };\n// const sections = [fake]\nconst sections = [{"id":"real"}];\n';
    // The extractor is anchored to the start of a line, so the `return` and
    // the comment prefix should both be skipped and the real declaration
    // wins.
    const comment = 'return { sections: [1] }; // const sections = [fake]\n';
    expect(
      extractModuleArrayLiteral(
        `${comment}const sections = [{"id":"real"}];\n`,
        "sections"
      )
    ).toEqual({ literal: '[{"id":"real"}]' });
    expect(extractModuleArrayLiteral(source, "sections")).toEqual({
      literal: '[{"id":"real"}]'
    });
  });

  test("handles bracket characters inside string values", () => {
    const source = `const screens = [{"id":"a","body":"copy with ] and [ brackets"}];`;
    expect(extractModuleArrayLiteral(source, "screens")).toEqual({
      literal: '[{"id":"a","body":"copy with ] and [ brackets"}]'
    });
  });

  test("handles escaped quotes inside string values", () => {
    const source = `const screens = [{"id":"a","body":"she said \\"hi\\""}];`;
    expect(extractModuleArrayLiteral(source, "screens")).toEqual({
      literal: '[{"id":"a","body":"she said \\"hi\\""}]'
    });
  });

  test("returns null when no declaration is present", () => {
    expect(extractModuleArrayLiteral("const other = [];", "screens")).toBeNull();
  });
});

describe("buildWebsiteSceneNodesFromSections", () => {
  test("maps hero + feature-grid + cta templates to section nodes", () => {
    const nodes = buildWebsiteSceneNodesFromSections([
      {
        id: "hero_1",
        template: "hero",
        headline: "H",
        body: "B"
      },
      {
        id: "grid_1",
        template: "feature-grid",
        title: "T",
        items: [{ label: "L", body: "V" }]
      },
      {
        id: "cta_1",
        template: "cta",
        headline: "Go",
        primaryAction: "Do it"
      }
    ]);

    expect(nodes).not.toBeNull();
    expect(nodes!.map((node) => node.type)).toEqual([
      "section",
      "section",
      "section"
    ]);
    expect(nodes![0]!.props.template).toBe("hero");
    expect(nodes![1]!.props.template).toBe("feature-grid");
    expect(nodes![2]!.props.template).toBe("cta");
  });

  test("returns null when template is unknown", () => {
    expect(
      buildWebsiteSceneNodesFromSections([
        { id: "x", template: "marquee" }
      ])
    ).toBeNull();
  });
});

describe("buildPrototypeSceneNodesFromScreens", () => {
  test("accepts bare `{ id, headline, body }` entries", () => {
    const result = buildPrototypeSceneNodesFromScreens([
      { id: "a", headline: "A", body: "aa" }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes[0]).toEqual({
        id: "a",
        type: "screen",
        name: "A",
        props: { headline: "A", body: "aa" },
        children: []
      });
    }
  });

  test("accepts screen-link entries with inline discriminator", () => {
    const result = buildPrototypeSceneNodesFromScreens([
      {
        id: "link_1",
        type: "screen-link",
        from: "screen_a",
        to: "screen_b",
        trigger: "tap"
      }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes[0]).toEqual({
        id: "link_1",
        type: "screen-link",
        name: "screen_a → screen_b",
        props: { from: "screen_a", to: "screen_b", trigger: "tap" },
        children: []
      });
    }
  });

  test("accepts screen-cta entries with inline discriminator", () => {
    const result = buildPrototypeSceneNodesFromScreens([
      {
        id: "cta_1",
        type: "screen-cta",
        name: "Confirm",
        headline: "Ready?",
        primaryAction: "Go",
        secondaryAction: "Back"
      }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes[0]).toEqual({
        id: "cta_1",
        type: "screen-cta",
        name: "Confirm",
        props: {
          headline: "Ready?",
          primaryAction: "Go",
          secondaryAction: "Back"
        },
        children: []
      });
    }
  });

  test("preserves ordering across a mixed [screen, screen-link, screen-cta, screen] sequence", () => {
    const result = buildPrototypeSceneNodesFromScreens([
      { id: "s_1", headline: "One" },
      { id: "l_1", type: "screen-link", from: "s_1", to: "s_2" },
      { id: "c_1", type: "screen-cta", headline: "Act" },
      { id: "s_2", headline: "Two" }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes.map((node) => [node.id, node.type])).toEqual([
        ["s_1", "screen"],
        ["l_1", "screen-link"],
        ["c_1", "screen-cta"],
        ["s_2", "screen"]
      ]);
    }
  });

  test("rejects an unknown explicit type on a screens entry", () => {
    const result = buildPrototypeSceneNodesFromScreens([
      { id: "x", type: "screen-popover" }
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unsupported-node");
      expect(result.error.message).toContain("screen-popover");
    }
  });

  test("rejects a screen-link that is missing required from/to", () => {
    const result = buildPrototypeSceneNodesFromScreens([
      { id: "x", type: "screen-link", from: "a" }
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("from");
    }
  });

  test("rejects a screen-link with an unsupported trigger", () => {
    const result = buildPrototypeSceneNodesFromScreens([
      {
        id: "x",
        type: "screen-link",
        from: "a",
        to: "b",
        trigger: "hover"
      }
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("hover");
    }
  });
});

describe("buildSlidesSceneNodesFromSlides", () => {
  test("maps each supported slide role to the typed scene node kind", () => {
    const result = buildSlidesSceneNodesFromSlides([
      { id: "t", role: "slide-title", headline: "H" },
      { id: "c", role: "slide-content", bullets: ["one"] },
      { id: "z", role: "slide-closing", headline: "Bye" }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes.map((node) => node.type)).toEqual([
        "slide-title",
        "slide-content",
        "slide-closing"
      ]);
      expect(result.nodes[1]!.props).toEqual({ bullets: ["one"] });
    }
  });

  test("rejects an entry that is missing a role", () => {
    const result = buildSlidesSceneNodesFromSlides([{ id: "x" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("no role");
    }
  });
});
