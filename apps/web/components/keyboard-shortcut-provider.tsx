"use client";

/**
 * Mounts a single global keydown listener that matches events against the
 * shortcut registry. The provider is intentionally lightweight: all state is
 * owned by the registry module; this component just wires listeners up.
 *
 * Focus rules: when the event target is an `<input>`, `<textarea>`, a
 * `contenteditable` element, or anything that looks like a code editor
 * (e.g. a Monaco/CodeMirror surface), we skip the listener entirely so
 * typing never gets hijacked. The two explicit exceptions are `Escape`
 * and any chord that uses the meta/ctrl modifier — those are always safe to
 * handle because they can't produce text.
 */

import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  chordMatchesEvent,
  detectPlatform,
  eventKey,
  list,
  parseChord,
  registerDefaults,
  type Shortcut,
  type ShortcutContext
} from "../lib/keyboard-shortcuts";
import { KeyboardHelpOverlay } from "./keyboard-help-overlay";

/** Max gap between keys in a sequence shortcut, milliseconds. */
const SEQUENCE_WINDOW_MS = 800;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // Common code-editor hosts expose an explicit role.
  const role = target.getAttribute("role");
  if (role === "textbox") return true;
  return false;
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

type ProviderProps = {
  children?: ReactNode;
  /** Register the default shortcut set on mount. Defaults to `true`. */
  registerDefaultShortcuts?: boolean;
};

export function KeyboardShortcutProvider({
  children,
  registerDefaultShortcuts = true
}: ProviderProps) {
  const pathname = usePathname() ?? "/";
  const platform = useMemo(() => detectPlatform(), []);
  const pending = useRef<{ shortcut: Shortcut; step: number; at: number } | null>(
    null
  );

  useEffect(() => {
    if (!registerDefaultShortcuts) return;
    return registerDefaults();
  }, [registerDefaultShortcuts]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const editing = isEditableTarget(event.target);
      // Skip when typing, unless it's Escape or a modifier combo.
      if (editing && !hasModifier(event) && eventKey(event) !== "escape") {
        pending.current = null;
        return;
      }

      const ctx: ShortcutContext = {
        platform,
        pathname,
        isEditing: editing
      };

      const shortcuts = list();
      const now = performance.now();

      // Continue an in-flight sequence if the gap is small enough.
      const active = pending.current;
      if (active && now - active.at <= SEQUENCE_WINDOW_MS) {
        const chord = parseChord(active.shortcut.keys[active.step], platform);
        if (chordMatchesEvent(chord, event)) {
          const nextStep = active.step + 1;
          if (nextStep >= active.shortcut.keys.length) {
            if (!active.shortcut.when || active.shortcut.when(ctx)) {
              event.preventDefault();
              active.shortcut.run(ctx);
            }
            pending.current = null;
            return;
          }
          pending.current = { shortcut: active.shortcut, step: nextStep, at: now };
          event.preventDefault();
          return;
        }
        // Mismatch — drop the sequence and keep evaluating as a fresh press.
        pending.current = null;
      }

      // Match against the first chord of every shortcut.
      for (const shortcut of shortcuts) {
        if (shortcut.keys.length === 0) continue;
        // Skip pseudo-chords like `space+drag` — those aren't plain keydowns.
        if (shortcut.keys.some((k) => k.toLowerCase().includes("drag"))) {
          continue;
        }
        if (shortcut.when && !shortcut.when(ctx)) continue;
        const first = parseChord(shortcut.keys[0], platform);
        if (!chordMatchesEvent(first, event)) continue;

        if (shortcut.keys.length === 1) {
          event.preventDefault();
          shortcut.run(ctx);
          return;
        }
        // Start a new sequence.
        pending.current = { shortcut, step: 1, at: now };
        event.preventDefault();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, platform]);

  return (
    <>
      {children}
      <KeyboardHelpOverlay />
    </>
  );
}
