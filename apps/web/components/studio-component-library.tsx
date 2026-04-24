"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Badge, Surface } from "@opendesign/ui";
import {
  componentPresets,
  filterPresetsByArtifactKind,
  groupPresetsBySection,
  searchPresets,
  type ComponentPreset,
  type ComponentPresetArtifactKind
} from "../lib/component-presets";

type StudioComponentLibraryProps = {
  /**
   * The artifact kind the library is scoped to. When set, the kind filter is
   * locked to this value (useful when hosted from a single-artifact Studio
   * page). When `undefined`, a "All / Website / Prototype / Slides" toggle is
   * rendered.
   */
  artifactKind?: ComponentPresetArtifactKind;
  /**
   * Invoked when the user activates a preset (click or Enter). The parent is
   * responsible for translating the preset into an
   * `appendSceneTemplateAction` payload and refreshing the workspace.
   */
  onAppend: (preset: ComponentPreset) => void;
};

type KindFilter = ComponentPresetArtifactKind | "all";

const kindFilterOptions: readonly { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "website", label: "Website" },
  { value: "prototype", label: "Prototype" },
  { value: "slides", label: "Slides" }
];

export function StudioComponentLibrary({
  artifactKind,
  onAppend
}: StudioComponentLibraryProps) {
  const searchInputId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>(artifactKind ?? "all");
  // Parent owns selection after append; this is only keyboard-cursor state.
  const [cursor, setCursor] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // When the parent locks the artifact kind, honour it regardless of toggle.
  const effectiveKindFilter: KindFilter = artifactKind ?? kindFilter;

  const visiblePresets = useMemo(() => {
    const byKind =
      effectiveKindFilter === "all"
        ? [...componentPresets]
        : filterPresetsByArtifactKind(componentPresets, effectiveKindFilter);
    return searchPresets(byKind, query);
  }, [effectiveKindFilter, query]);

  const sections = useMemo(
    () => groupPresetsBySection(visiblePresets),
    [visiblePresets]
  );

  // Clamp the cursor whenever the visible list shrinks (search / filter).
  const clampedCursor =
    visiblePresets.length === 0
      ? -1
      : Math.min(cursor, visiblePresets.length - 1);

  function focusCard(index: number) {
    const target = gridRef.current?.querySelector<HTMLElement>(
      `[data-preset-index="${index}"]`
    );
    target?.focus();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && visiblePresets.length > 0) {
      event.preventDefault();
      setCursor(0);
      focusCard(0);
    } else if (event.key === "Enter" && visiblePresets.length > 0) {
      event.preventDefault();
      const target = visiblePresets[Math.max(0, clampedCursor)];
      if (target) {
        onAppend(target);
      }
    }
  }

  function handleCardKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
    preset: ComponentPreset
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(index + 1, visiblePresets.length - 1);
      setCursor(next);
      focusCard(next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) {
        setCursor(-1);
        document.getElementById(searchInputId)?.focus();
        return;
      }
      const next = Math.max(index - 1, 0);
      setCursor(next);
      focusCard(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onAppend(preset);
    }
  }

  // Flat index lookup so grouped rendering can still emit `data-preset-index`
  // in the same order as `visiblePresets` — what keyboard nav iterates over.
  const flatIndexOf = useMemo(() => {
    const map = new Map<string, number>();
    visiblePresets.forEach((preset, index) => map.set(preset.id, index));
    return map;
  }, [visiblePresets]);

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>Component library</h3>
        <p className="footer-note">
          Click a preset to append it to the current artifact. Use ↑/↓ to
          navigate, Enter to append.
        </p>
      </div>
      <div className="stack-form">
        <label className="field" htmlFor={searchInputId}>
          <span>Search presets</span>
          <input
            id={searchInputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Hero, pricing, onboarding, closing…"
            role="combobox"
            aria-expanded={visiblePresets.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
          />
        </label>
        {artifactKind ? null : (
          <div className="artifact-action-grid" role="radiogroup" aria-label="Artifact kind">
            {kindFilterOptions.map((option) => {
              const active = kindFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-active={active}
                  onClick={() => {
                    setKindFilter(option.value);
                    setCursor(0);
                  }}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--border-default)",
                    background: active ? "var(--accent-soft-bg)" : "transparent",
                    color: active ? "var(--text-accent)" : "var(--text-secondary)",
                    fontSize: "0.8125rem",
                    cursor: "pointer"
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div
        ref={gridRef}
        id={listboxId}
        role="listbox"
        aria-label="Component presets"
        className="scene-node-list"
        style={{ maxHeight: 520, overflowY: "auto" }}
      >
        {visiblePresets.length === 0 ? (
          <p className="footer-note">
            No presets match “{query}”. Clear the search or switch the
            artifact-kind filter.
          </p>
        ) : (
          sections.map((section) => (
            <section key={section.group} className="scene-node-section">
              <div className="project-meta">
                <Badge tone="muted">{section.label}</Badge>
                <span className="footer-note">
                  {section.presets.length} preset
                  {section.presets.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="artifact-action-grid">
                {section.presets.map((preset) => {
                  const index = flatIndexOf.get(preset.id) ?? 0;
                  const isCursor = index === clampedCursor;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="option"
                      aria-selected={isCursor}
                      data-preset-index={index}
                      data-preset-id={preset.id}
                      tabIndex={isCursor ? 0 : -1}
                      onClick={() => onAppend(preset)}
                      onFocus={() => setCursor(index)}
                      onKeyDown={(event) =>
                        handleCardKeyDown(event, index, preset)
                      }
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 6,
                        padding: "12px 14px",
                        textAlign: "left",
                        borderRadius: "var(--radius-md, 10px)",
                        border: "1px solid var(--border-default)",
                        background: isCursor
                          ? "var(--accent-soft-bg)"
                          : "var(--bg-surface)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        width: "100%"
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          fontFamily:
                            "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
                          fontSize: "0.75rem",
                          color: "var(--text-muted)"
                        }}
                      >
                        {preset.thumbnail}
                      </span>
                      <strong style={{ fontSize: "0.875rem", lineHeight: 1.2 }}>
                        {preset.title}
                      </strong>
                      <span
                        className="footer-note"
                        style={{ fontSize: "0.75rem" }}
                      >
                        {preset.description}
                      </span>
                      <span
                        className="footer-note"
                        style={{
                          fontSize: "0.6875rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em"
                        }}
                      >
                        {preset.artifactKinds.join(" · ")} · {preset.templateKind}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </Surface>
  );
}

export type { ComponentPreset, ComponentPresetArtifactKind };
