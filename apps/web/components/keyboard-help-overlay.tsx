"use client";

/**
 * `?` opens a grouped cheat sheet of every registered shortcut. Grouping
 * follows the fixed {@link SHORTCUT_SECTIONS} order so the overlay reads
 * the same way everywhere.
 *
 * The overlay subscribes to the registry so any future
 * `register()`/`unregister()` call updates the cheat sheet live.
 */

import { useEffect, useMemo, useState } from "react";
import {
  SHORTCUT_SECTIONS,
  detectPlatform,
  formatKeys,
  subscribe,
  type Shortcut,
  type ShortcutSection
} from "../lib/keyboard-shortcuts";
import { useT } from "../lib/i18n";

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "color-mix(in srgb, var(--od-color-bg, #000) 72%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px"
};

const PANEL_STYLE: React.CSSProperties = {
  width: "min(760px, 100%)",
  maxHeight: "min(80vh, 720px)",
  overflow: "auto",
  borderRadius: 16,
  padding: "24px 28px",
  background: "var(--od-color-surface, #111)",
  color: "var(--od-color-text, #f5f5f5)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  border: "1px solid var(--od-color-border, rgba(255,255,255,0.08))"
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: 16
};

const SECTION_STYLE: React.CSSProperties = {
  marginTop: 20
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  opacity: 0.6,
  marginBottom: 8
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
  borderBottom: "1px solid var(--od-color-border, rgba(255,255,255,0.06))",
  gap: 16
};

const KBD_STYLE: React.CSSProperties = {
  fontFamily: "var(--od-font-mono, ui-monospace, SFMono-Regular, monospace)",
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 6,
  background: "var(--od-color-surface-muted, rgba(255,255,255,0.08))",
  border: "1px solid var(--od-color-border, rgba(255,255,255,0.12))"
};

export function KeyboardHelpOverlay() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<readonly Shortcut[]>([]);
  const platform = useMemo(() => detectPlatform(), []);

  useEffect(() => subscribe(setShortcuts), []);

  useEffect(() => {
    function onToggle() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("opendesign:help.toggle", onToggle);
    return () => window.removeEventListener("opendesign:help.toggle", onToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const grouped = useMemo(() => {
    const buckets = new Map<ShortcutSection, Shortcut[]>();
    for (const section of SHORTCUT_SECTIONS) buckets.set(section, []);
    for (const s of shortcuts) {
      const bucket = buckets.get(s.section);
      if (bucket) bucket.push(s);
    }
    return buckets;
  }, [shortcuts]);

  if (!open) return null;

  return (
    <div
      style={OVERLAY_STYLE}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div style={PANEL_STYLE}>
        <div style={HEADER_STYLE}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t("keyboard.help.title")}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("keyboard.help.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: 18,
              opacity: 0.7
            }}
          >
            {"\u2715"}
          </button>
        </div>
        {SHORTCUT_SECTIONS.map((section) => {
          const rows = grouped.get(section) ?? [];
          if (rows.length === 0) return null;
          return (
            <section key={section} style={SECTION_STYLE}>
              <div style={SECTION_TITLE_STYLE}>{section}</div>
              {rows.map((s) => (
                <div key={s.id} style={ROW_STYLE}>
                  <span>{s.title}</span>
                  <kbd style={KBD_STYLE}>{formatKeys(s.keys, platform)}</kbd>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
