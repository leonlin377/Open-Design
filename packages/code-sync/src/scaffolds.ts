import type { SceneNode } from "@opendesign/contracts";

// ---------------------------------------------------------------------------
// Scaffold surface
//
// SYNC-004 extends the safe code → scene back-sync surface beyond the original
// single inline `const sections = [...]` scaffold that only worked for website
// artifacts. The shapes we now accept are all stable literals that the
// generation pipeline (or a human editor) can plausibly produce:
//
//  - website:   `const sections = [...]`    (legacy inline scaffold)
//  - website:   `export const sections = [...]`  (named-export variant)
//  - prototype: `const screens  = [...]`    (new prototype scaffold)
//  - prototype: `export const screens = [...]`
//  - slides:    `const slides   = [...]`    (new slides scaffold)
//  - slides:    `export const slides = [...]`
//
// Anything outside of this surface must fail closed with a specific human
// readable reason so scene state is never silently corrupted.
// ---------------------------------------------------------------------------

export type ExtractedArrayLiteral = {
  /**
   * The raw text between the opening `[` and closing `]` including both
   * brackets. Safe to feed to JSON.parse once we strip unsupported pieces
   * (see extractModuleArrayLiteral for details).
   */
  literal: string;
};

type StringState = "none" | "single" | "double" | "back";

/**
 * Returns the code text of a module-scope `const NAME = [ ... ];` (or
 * `export const NAME = [ ... ];`) declaration. Returns null if the declaration
 * is not present or its right-hand side is not a top-level array literal.
 *
 * The implementation walks the source character by character so array
 * literals that contain nested `]` inside strings round-trip safely. This is
 * important because the generated scaffolds call JSON.stringify on the scene
 * sections, so the literal may embed arbitrary user copy.
 */
export function extractModuleArrayLiteral(
  source: string,
  identifier: string
): ExtractedArrayLiteral | null {
  // Two supported declaration prefixes, both anchored to the start of a line.
  const prefixes = [`const ${identifier} = `, `export const ${identifier} = `];

  let declarationIndex = -1;

  for (const prefix of prefixes) {
    const candidateIndex = findDeclarationStart(source, prefix);

    if (candidateIndex !== -1) {
      declarationIndex = candidateIndex + prefix.length;
      break;
    }
  }

  if (declarationIndex === -1) {
    return null;
  }

  // Skip leading whitespace between `=` and `[`.
  let cursor = declarationIndex;
  while (cursor < source.length && /\s/.test(source[cursor]!)) {
    cursor += 1;
  }

  if (source[cursor] !== "[") {
    return null;
  }

  const start = cursor;
  let depth = 0;
  let stringState: StringState = "none";
  let escape = false;

  for (; cursor < source.length; cursor += 1) {
    const char = source[cursor]!;

    if (stringState !== "none") {
      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (
        (stringState === "single" && char === "'") ||
        (stringState === "double" && char === '"') ||
        (stringState === "back" && char === "`")
      ) {
        stringState = "none";
      }
      continue;
    }

    if (char === "'") {
      stringState = "single";
      continue;
    }
    if (char === '"') {
      stringState = "double";
      continue;
    }
    if (char === "`") {
      stringState = "back";
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return { literal: source.slice(start, cursor + 1) };
      }
    }
  }

  return null;
}

/**
 * Finds a prefix at the start of a line (allowing leading whitespace). This
 * avoids matching e.g. `// const sections = []` in a comment or
 * `return { sections: [] }` in a trailing expression.
 */
function findDeclarationStart(source: string, prefix: string): number {
  let cursor = 0;
  while (cursor < source.length) {
    const candidate = source.indexOf(prefix, cursor);
    if (candidate === -1) {
      return -1;
    }

    // Walk backwards to the previous newline / start of file, skipping only
    // horizontal whitespace. If we encounter any other character the match is
    // not at module scope, so keep searching.
    let backtrack = candidate - 1;
    let atLineStart = true;
    while (backtrack >= 0) {
      const prev = source[backtrack]!;
      if (prev === "\n") {
        break;
      }
      if (prev !== " " && prev !== "\t") {
        atLineStart = false;
        break;
      }
      backtrack -= 1;
    }

    if (atLineStart) {
      return candidate;
    }

    cursor = candidate + prefix.length;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Typed record readers shared across website / prototype / slides scaffolds.
// ---------------------------------------------------------------------------

export function isIdentifiedRecord(value: unknown): value is { id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

export function readOptionalString(
  value: unknown,
  key: string
): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

export function readOptionalStringArray(
  value: unknown,
  key: string
): string[] | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  if (!Array.isArray(candidate)) {
    return null;
  }

  if (!candidate.every((entry): entry is string => typeof entry === "string")) {
    return null;
  }

  return candidate;
}

export function readFeatureItems(
  value: unknown
): Array<{ label: string; body: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is {
      label: string;
      body: string;
    } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { body?: unknown }).body === "string"
  );
}

// ---------------------------------------------------------------------------
// Website scaffold: sections[]
// ---------------------------------------------------------------------------

export function buildWebsiteSceneNodesFromSections(
  sections: unknown
): SceneNode[] | null {
  if (!Array.isArray(sections)) {
    return null;
  }

  const nodes: SceneNode[] = [];

  for (const section of sections) {
    if (
      !isIdentifiedRecord(section) ||
      typeof (section as { template?: unknown }).template !== "string"
    ) {
      return null;
    }

    const template = (section as unknown as { template: string }).template;
    const name =
      readOptionalString(section, "name") ??
      (template === "hero"
        ? "Hero Section"
        : template === "feature-grid"
          ? "Feature Grid"
          : template === "cta"
            ? "Call To Action"
            : "Section");

    if (template === "hero") {
      const eyebrow = readOptionalString(section, "eyebrow");
      const headline = readOptionalString(section, "headline");
      const body = readOptionalString(section, "body");

      nodes.push({
        id: section.id,
        type: "section",
        name,
        props: {
          template: "hero",
          ...(eyebrow ? { eyebrow } : {}),
          ...(headline ? { headline } : {}),
          ...(body ? { body } : {})
        },
        children: []
      });
      continue;
    }

    if (template === "feature-grid") {
      const title = readOptionalString(section, "title");
      const items = readFeatureItems(
        (section as Record<string, unknown>).items
      );
      nodes.push({
        id: section.id,
        type: "section",
        name,
        props: {
          template: "feature-grid",
          ...(title ? { title } : {}),
          ...(items.length > 0 ? { items } : {})
        },
        children: []
      });
      continue;
    }

    if (template === "cta") {
      const headline = readOptionalString(section, "headline");
      const body = readOptionalString(section, "body");
      const primaryAction = readOptionalString(section, "primaryAction");
      const secondaryAction = readOptionalString(section, "secondaryAction");

      nodes.push({
        id: section.id,
        type: "section",
        name,
        props: {
          template: "cta",
          ...(headline ? { headline } : {}),
          ...(body ? { body } : {}),
          ...(primaryAction ? { primaryAction } : {}),
          ...(secondaryAction ? { secondaryAction } : {})
        },
        children: []
      });
      continue;
    }

    return null;
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Prototype scaffold: screens[]
//
// SYNC-005 extends the round-trip surface to cover prototype transitions and
// call-to-action beats. Entries in the `const screens = [...]` literal can now
// be one of three inline-discriminator shapes:
//
//   { id, name?, headline?, body?, eyebrow? }                 → type: "screen"
//   { type: "screen", ... }                                   → type: "screen"
//   { type: "screen-link", id, from, to, trigger?, name? }    → type: "screen-link"
//   { type: "screen-cta", id, name?, headline?, body?, primaryAction?, secondaryAction? }
//                                                             → type: "screen-cta"
//
// Ordering is preserved exactly — a mixed sequence like
// [screen, screen-link, screen-cta, screen] round-trips byte-for-byte. The
// alternative sibling-literal shape (`const screenLinks = [...]` +
// `const screenCtas = [...]`) was rejected because it forces consumers to pick
// an interleaving convention; the inline discriminator keeps scene ordering
// authoritative without extra surface.
// ---------------------------------------------------------------------------

export type PrototypeParseError = {
  kind: "unsupported-node" | "invalid-entry";
  message: string;
};

export type PrototypeParseResult =
  | { ok: true; nodes: SceneNode[] }
  | { ok: false; error: PrototypeParseError };

const PROTOTYPE_SUPPORTED_TYPES = new Set([
  "screen",
  "screen-link",
  "screen-cta"
]);
const SCREEN_LINK_TRIGGERS = new Set(["tap", "swipe", "auto"]);

export function buildPrototypeSceneNodesFromScreens(
  screens: unknown
): PrototypeParseResult {
  if (!Array.isArray(screens)) {
    return {
      ok: false,
      error: {
        kind: "invalid-entry",
        message: "`const screens = [...]` value must be an array literal."
      }
    };
  }

  const nodes: SceneNode[] = [];

  for (const entry of screens) {
    if (!isIdentifiedRecord(entry)) {
      return {
        ok: false,
        error: {
          kind: "invalid-entry",
          message:
            "Every prototype screen must be an object with at least a string `id`."
        }
      };
    }

    const explicitType = readOptionalString(entry, "type");

    if (explicitType && !PROTOTYPE_SUPPORTED_TYPES.has(explicitType)) {
      return {
        ok: false,
        error: {
          kind: "unsupported-node",
          message: `Prototype screen entries must use type "screen" | "screen-link" | "screen-cta"; got "${explicitType}".`
        }
      };
    }

    if (explicitType === "screen-link") {
      const from = readOptionalString(entry, "from");
      const to = readOptionalString(entry, "to");
      if (!from || !to) {
        return {
          ok: false,
          error: {
            kind: "invalid-entry",
            message: `Prototype screen-link "${entry.id}" must declare string \`from\` and \`to\` fields.`
          }
        };
      }
      const trigger = readOptionalString(entry, "trigger");
      if (trigger && !SCREEN_LINK_TRIGGERS.has(trigger)) {
        return {
          ok: false,
          error: {
            kind: "invalid-entry",
            message: `Prototype screen-link "${entry.id}" has unsupported trigger "${trigger}"; expected "tap" | "swipe" | "auto".`
          }
        };
      }
      const name =
        readOptionalString(entry, "name") ?? `${from} → ${to}`;
      nodes.push({
        id: entry.id,
        type: "screen-link",
        name,
        props: {
          from,
          to,
          ...(trigger ? { trigger } : {})
        },
        children: []
      });
      continue;
    }

    if (explicitType === "screen-cta") {
      const headline = readOptionalString(entry, "headline");
      const body = readOptionalString(entry, "body");
      const primaryAction = readOptionalString(entry, "primaryAction");
      const secondaryAction = readOptionalString(entry, "secondaryAction");
      const name =
        readOptionalString(entry, "name") ?? headline ?? "Call to action";

      nodes.push({
        id: entry.id,
        type: "screen-cta",
        name,
        props: {
          ...(headline ? { headline } : {}),
          ...(body ? { body } : {}),
          ...(primaryAction ? { primaryAction } : {}),
          ...(secondaryAction ? { secondaryAction } : {})
        },
        children: []
      });
      continue;
    }

    // Either explicitType === "screen" or no explicit type — plain screen.
    const headline = readOptionalString(entry, "headline");
    const body = readOptionalString(entry, "body");
    const eyebrow = readOptionalString(entry, "eyebrow");
    const name = readOptionalString(entry, "name") ?? headline ?? "Screen";

    nodes.push({
      id: entry.id,
      type: "screen",
      name,
      props: {
        ...(eyebrow ? { eyebrow } : {}),
        ...(headline ? { headline } : {}),
        ...(body ? { body } : {})
      },
      children: []
    });
  }

  return { ok: true, nodes };
}

// ---------------------------------------------------------------------------
// Slides scaffold: slides[]
//
// Entries are discriminated on a `role` field that maps directly to the typed
// slide node kinds declared in @opendesign/contracts.
// ---------------------------------------------------------------------------

export type SlidesParseError = {
  message: string;
};

export type SlidesParseResult =
  | { ok: true; nodes: SceneNode[] }
  | { ok: false; error: SlidesParseError };

const SLIDE_ROLE_TYPES = new Set([
  "slide-title",
  "slide-content",
  "slide-closing"
]);

export function buildSlidesSceneNodesFromSlides(
  slides: unknown
): SlidesParseResult {
  if (!Array.isArray(slides)) {
    return {
      ok: false,
      error: {
        message: "`const slides = [...]` value must be an array literal."
      }
    };
  }

  const nodes: SceneNode[] = [];

  for (const entry of slides) {
    if (!isIdentifiedRecord(entry)) {
      return {
        ok: false,
        error: {
          message:
            "Every slide entry must be an object with at least a string `id`."
        }
      };
    }

    const role = readOptionalString(entry, "role");

    if (!role || !SLIDE_ROLE_TYPES.has(role)) {
      return {
        ok: false,
        error: {
          message: `Slide entries must declare role "slide-title" | "slide-content" | "slide-closing"; got ${role === null ? "no role" : `"${role}"`}.`
        }
      };
    }

    const headline = readOptionalString(entry, "headline");
    const body = readOptionalString(entry, "body");
    const name =
      readOptionalString(entry, "name") ??
      headline ??
      (role === "slide-title"
        ? "Title Slide"
        : role === "slide-content"
          ? "Content Slide"
          : "Closing Slide");

    if (role === "slide-content") {
      const bullets = readOptionalStringArray(entry, "bullets");
      nodes.push({
        id: entry.id,
        type: role,
        name,
        props: {
          ...(headline ? { headline } : {}),
          ...(body ? { body } : {}),
          ...(bullets && bullets.length > 0 ? { bullets } : {})
        },
        children: []
      });
      continue;
    }

    nodes.push({
      id: entry.id,
      type: role,
      name,
      props: {
        ...(headline ? { headline } : {}),
        ...(body ? { body } : {})
      },
      children: []
    });
  }

  return { ok: true, nodes };
}
