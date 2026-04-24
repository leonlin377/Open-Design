import {
  componentPresets,
  type ComponentPreset,
  type ComponentPresetArtifactKind,
  type ComponentPresetGroup
} from "../data/component-presets";

/**
 * Return every preset that supports the given artifact kind.
 *
 * Stays order-stable against the source catalogue so the UI's ↑/↓ keyboard
 * navigation feels predictable as the kind filter toggles.
 */
export function filterPresetsByArtifactKind(
  presets: readonly ComponentPreset[],
  kind: ComponentPresetArtifactKind
): ComponentPreset[] {
  return presets.filter((preset) => preset.artifactKinds.includes(kind));
}

/**
 * Case-insensitive substring search across `title`, `description`, and `id`.
 *
 * An empty / whitespace-only query returns the input list unchanged — the UI
 * relies on that behaviour to render the full grid when the search input is
 * cleared.
 */
export function searchPresets(
  presets: readonly ComponentPreset[],
  query: string
): ComponentPreset[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return [...presets];
  }

  return presets.filter((preset) => {
    const haystack = `${preset.title} ${preset.description} ${preset.id}`.toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * A section header plus its ordered preset list. Rendered as a single
 * `<section>` in the library grid.
 */
export type ComponentPresetSection = {
  group: ComponentPresetGroup;
  label: string;
  presets: ComponentPreset[];
};

const groupLabels: Record<ComponentPresetGroup, string> = {
  hero: "Hero",
  feature: "Features",
  pricing: "Pricing",
  cta: "Call to action",
  flow: "Flows",
  cover: "Covers",
  divider: "Dividers",
  content: "Content",
  closing: "Closings"
};

/**
 * Canonical group order — keeps section headers in a sensible reading order
 * regardless of how the preset catalogue is authored.
 */
const groupOrder: readonly ComponentPresetGroup[] = [
  "hero",
  "feature",
  "pricing",
  "cta",
  "flow",
  "cover",
  "divider",
  "content",
  "closing"
];

/**
 * Group presets by their `group` field and return sections in the canonical
 * order. Empty groups are omitted so the UI never renders an empty header.
 */
export function groupPresetsBySection(
  presets: readonly ComponentPreset[]
): ComponentPresetSection[] {
  const buckets = new Map<ComponentPresetGroup, ComponentPreset[]>();

  for (const preset of presets) {
    const bucket = buckets.get(preset.group);
    if (bucket) {
      bucket.push(preset);
    } else {
      buckets.set(preset.group, [preset]);
    }
  }

  const sections: ComponentPresetSection[] = [];
  for (const group of groupOrder) {
    const items = buckets.get(group);
    if (items && items.length > 0) {
      sections.push({ group, label: groupLabels[group], presets: items });
    }
  }
  return sections;
}

export { componentPresets };
export type { ComponentPreset, ComponentPresetArtifactKind, ComponentPresetGroup };
