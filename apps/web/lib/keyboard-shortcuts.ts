/**
 * Keyboard shortcut registry.
 *
 * Design notes:
 * - Shortcuts are described as arrays of key strings. Each entry in `keys` is
 *   a chord string like `cmd+k` or `g`. Multi-entry arrays describe
 *   sequences (e.g. `["g", "p"]` = press `g` then `p`).
 * - Chord strings are normalized: `cmd`, `meta`, `command` all map to the
 *   platform-primary meta modifier. On macOS that is the Command key; on
 *   other platforms it is Control. `ctrl` always means the literal Control
 *   key. This means `cmd+k` "works" cross-platform by resolving to
 *   `meta+k` on macOS and `ctrl+k` on Windows/Linux.
 * - The registry is intentionally tiny and framework-agnostic so the provider
 *   component can own React state while this module owns the data.
 */

export type ShortcutSection = "Global" | "Studio" | "Canvas" | "Chat";

export const SHORTCUT_SECTIONS: readonly ShortcutSection[] = [
  "Global",
  "Studio",
  "Canvas",
  "Chat"
] as const;

export type ShortcutContext = {
  /** `"mac"` when running on an Apple platform, otherwise `"other"`. */
  platform: "mac" | "other";
  /** Active route pathname at the time the shortcut fires. */
  pathname: string;
  /** `true` when focus is in an editable element. */
  isEditing: boolean;
};

export type Shortcut = {
  id: string;
  title: string;
  /**
   * Ordered list of chord strings. A single-entry array is a normal chord
   * (e.g. `["cmd+k"]`). Multi-entry arrays describe a sequence fired within
   * a short window (e.g. `["g", "p"]`).
   */
  keys: string[];
  section: ShortcutSection;
  /** Optional predicate. When absent the shortcut is always active. */
  when?: (ctx: ShortcutContext) => boolean;
  run: (ctx: ShortcutContext) => void;
};

/**
 * A parsed, canonical chord. Modifier booleans are driven by the *logical*
 * meta key so matching works identically across platforms.
 */
export type NormalizedChord = {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Lowercased key identifier, e.g. `"k"`, `"enter"`, `"?"`, `"arrowleft"`. */
  key: string;
};

const MODIFIER_ALIASES: Record<string, keyof Omit<NormalizedChord, "key">> = {
  cmd: "meta",
  command: "meta",
  meta: "meta",
  super: "meta",
  win: "meta",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift"
};

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  escape: "escape",
  del: "delete",
  delete: "delete",
  return: "enter",
  enter: "enter",
  space: " ",
  spacebar: " ",
  plus: "+",
  minus: "-",
  left: "arrowleft",
  right: "arrowright",
  up: "arrowup",
  down: "arrowdown"
};

export function detectPlatform(): "mac" | "other" {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const raw =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(raw) ? "mac" : "other";
}

/**
 * Parse a chord like `cmd+shift+k` or `?` into a {@link NormalizedChord}.
 *
 * Cross-platform behavior: `cmd`/`meta`/`command` are treated as the meta
 * modifier on macOS and are rewritten to `ctrl` on other platforms so a
 * single shortcut definition works everywhere. `ctrl` is always literal.
 */
export function parseChord(
  chord: string,
  platform: "mac" | "other" = detectPlatform()
): NormalizedChord {
  const result: NormalizedChord = {
    meta: false,
    ctrl: false,
    alt: false,
    shift: false,
    key: ""
  };
  const parts = chord
    .trim()
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return result;
  }
  // A trailing `+` means the literal plus key (e.g. `"+"`).
  if (chord.trim() === "+") {
    result.key = "+";
    return result;
  }
  for (let i = 0; i < parts.length; i += 1) {
    const piece = parts[i];
    const isLast = i === parts.length - 1;
    const modifier = MODIFIER_ALIASES[piece];
    if (modifier && !isLast) {
      if (modifier === "meta" && platform !== "mac") {
        result.ctrl = true;
      } else {
        result[modifier] = true;
      }
      continue;
    }
    // Last token is the key itself.
    const canonical = KEY_ALIASES[piece] ?? piece;
    result.key = canonical;
  }
  return result;
}

/**
 * Read the canonical key name from a KeyboardEvent so it can be compared to
 * a parsed chord's `key` field.
 */
export function eventKey(event: KeyboardEvent): string {
  const raw = event.key;
  if (!raw) return "";
  const lower = raw.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

export function chordMatchesEvent(
  chord: NormalizedChord,
  event: KeyboardEvent
): boolean {
  if (chord.meta !== event.metaKey) return false;
  if (chord.ctrl !== event.ctrlKey) return false;
  if (chord.alt !== event.altKey) return false;
  if (chord.shift !== event.shiftKey) return false;
  return eventKey(event) === chord.key;
}

/** Human-readable rendering of a chord for the cheat sheet. */
export function formatChord(
  chord: string,
  platform: "mac" | "other" = detectPlatform()
): string {
  const parts = chord
    .trim()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (chord.trim() === "+") return "+";
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const piece = parts[i].toLowerCase();
    const isLast = i === parts.length - 1;
    const modifier = MODIFIER_ALIASES[piece];
    if (modifier && !isLast) {
      if (modifier === "meta") {
        out.push(platform === "mac" ? "\u2318" : "Ctrl");
      } else if (modifier === "shift") {
        out.push(platform === "mac" ? "\u21E7" : "Shift");
      } else if (modifier === "alt") {
        out.push(platform === "mac" ? "\u2325" : "Alt");
      } else if (modifier === "ctrl") {
        out.push(platform === "mac" ? "\u2303" : "Ctrl");
      }
      continue;
    }
    const canonical = KEY_ALIASES[piece] ?? piece;
    if (canonical === " ") out.push("Space");
    else if (canonical === "arrowleft") out.push("\u2190");
    else if (canonical === "arrowright") out.push("\u2192");
    else if (canonical === "arrowup") out.push("\u2191");
    else if (canonical === "arrowdown") out.push("\u2193");
    else if (canonical === "enter") out.push(platform === "mac" ? "\u23CE" : "Enter");
    else if (canonical === "escape") out.push("Esc");
    else if (canonical === "delete") out.push(platform === "mac" ? "\u232B" : "Del");
    else out.push(canonical.length === 1 ? canonical.toUpperCase() : canonical);
  }
  return out.join(platform === "mac" ? "" : "+");
}

export function formatKeys(
  keys: string[],
  platform: "mac" | "other" = detectPlatform()
): string {
  return keys.map((k) => formatChord(k, platform)).join(" then ");
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

type Listener = (shortcuts: readonly Shortcut[]) => void;

const registry = new Map<string, Shortcut>();
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot = Array.from(registry.values());
  for (const listener of listeners) listener(snapshot);
}

export function register(shortcut: Shortcut): () => void {
  registry.set(shortcut.id, shortcut);
  emit();
  return () => unregister(shortcut.id);
}

export function registerMany(shortcuts: readonly Shortcut[]): () => void {
  for (const s of shortcuts) registry.set(s.id, s);
  emit();
  return () => {
    for (const s of shortcuts) registry.delete(s.id);
    emit();
  };
}

export function unregister(id: string): void {
  if (registry.delete(id)) emit();
}

export function list(): readonly Shortcut[] {
  return Array.from(registry.values());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(Array.from(registry.values()));
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: wipe state so specs don't leak between runs. */
export function __resetRegistry(): void {
  registry.clear();
  listeners.clear();
}

// ---------------------------------------------------------------------------
// Default shortcut definitions
// ---------------------------------------------------------------------------

/**
 * Client-side handlers dispatch custom DOM events so the provider stays
 * decoupled from the rest of the app. Feature code can `window.addEventListener`
 * for e.g. `"opendesign:studio.generate"` to react.
 */
function fire(name: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

const inStudio = (ctx: ShortcutContext) => ctx.pathname.startsWith("/studio");
const inChat = (ctx: ShortcutContext) =>
  ctx.pathname.startsWith("/studio") || ctx.pathname.startsWith("/chat");
const inCanvas = (ctx: ShortcutContext) => ctx.pathname.startsWith("/studio");

export const DEFAULT_SHORTCUTS: readonly Shortcut[] = [
  // Global -----------------------------------------------------------------
  {
    id: "global.help",
    title: "Show keyboard shortcuts",
    keys: ["?"],
    section: "Global",
    run: () => fire("opendesign:help.toggle")
  },
  {
    id: "global.command-palette",
    title: "Open command palette",
    keys: ["cmd+k"],
    section: "Global",
    run: () => fire("opendesign:palette.open")
  },
  {
    id: "global.focus-search",
    title: "Focus search",
    keys: ["cmd+/"],
    section: "Global",
    run: () => fire("opendesign:search.focus")
  },
  {
    id: "global.goto-projects",
    title: "Go to projects",
    keys: ["g", "p"],
    section: "Global",
    run: () => {
      if (typeof window !== "undefined") window.location.assign("/projects");
    }
  },
  {
    id: "global.goto-studio",
    title: "Go to studio",
    keys: ["g", "s"],
    section: "Global",
    run: () => {
      if (typeof window !== "undefined") window.location.assign("/studio");
    }
  },
  {
    id: "global.toggle-theme",
    title: "Toggle theme",
    keys: ["cmd+shift+d"],
    section: "Global",
    run: () => fire("opendesign:theme.toggle")
  },

  // Studio -----------------------------------------------------------------
  {
    id: "studio.generate",
    title: "Generate",
    keys: ["cmd+enter"],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:studio.generate")
  },
  {
    id: "studio.cancel",
    title: "Cancel generation",
    keys: ["cmd+."],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:studio.cancel")
  },
  {
    id: "studio.export",
    title: "Open export panel",
    keys: ["cmd+shift+e"],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:studio.export")
  },
  {
    id: "studio.comments",
    title: "Open comments",
    keys: ["cmd+shift+m"],
    section: "Studio",
    when: inStudio,
    run: () =>
      fire("opendesign:studio.review.open", { tab: "comments" })
  },
  {
    id: "studio.chat",
    title: "Open chat",
    keys: ["cmd+shift+c"],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:studio.chat")
  },
  {
    id: "studio.left-rail",
    title: "Toggle left rail",
    keys: ["cmd+\\"],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:studio.left-rail.toggle")
  },
  {
    id: "studio.right-rail",
    title: "Toggle right rail",
    keys: ["cmd+shift+\\"],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:studio.right-rail.toggle")
  },
  {
    id: "studio.library",
    title: "Open library",
    keys: ["cmd+shift+l"],
    section: "Studio",
    when: inStudio,
    run: () =>
      fire("opendesign:studio.library.open", { tab: "components" })
  },
  {
    id: "studio.palette",
    title: "Open palette",
    keys: ["cmd+shift+p"],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:studio.library.open", { tab: "palette" })
  },
  {
    id: "studio.compose",
    title: "Toggle Compose bar",
    keys: ["cmd+shift+o"],
    section: "Studio",
    when: inStudio,
    run: () => fire("opendesign:compose.toggle")
  },

  // Canvas -----------------------------------------------------------------
  {
    id: "canvas.fit",
    title: "Fit to canvas",
    keys: ["1"],
    section: "Canvas",
    when: inCanvas,
    run: () => fire("opendesign:canvas.fit")
  },
  {
    id: "canvas.reset",
    title: "Reset zoom",
    keys: ["0"],
    section: "Canvas",
    when: inCanvas,
    run: () => fire("opendesign:canvas.reset")
  },
  {
    id: "canvas.zoom-in",
    title: "Zoom in",
    keys: ["+"],
    section: "Canvas",
    when: inCanvas,
    run: () => fire("opendesign:canvas.zoom", { delta: 1 })
  },
  {
    id: "canvas.zoom-out",
    title: "Zoom out",
    keys: ["-"],
    section: "Canvas",
    when: inCanvas,
    run: () => fire("opendesign:canvas.zoom", { delta: -1 })
  },
  {
    id: "canvas.pan",
    title: "Pan (hold Space, drag)",
    keys: ["space+drag"],
    section: "Canvas",
    when: inCanvas,
    // Pan is handled by the canvas itself via pointer + keydown tracking.
    // We keep it in the registry so it shows up on the cheat sheet but do
    // nothing when dispatched from the global listener.
    run: () => {}
  },
  {
    id: "canvas.select-tool",
    title: "Select tool",
    keys: ["v"],
    section: "Canvas",
    when: inCanvas,
    run: () => fire("opendesign:canvas.tool", { tool: "select" })
  },
  {
    id: "canvas.duplicate",
    title: "Duplicate node",
    keys: ["cmd+d"],
    section: "Canvas",
    when: inCanvas,
    run: () => fire("opendesign:canvas.duplicate")
  },
  {
    id: "canvas.delete",
    title: "Delete node",
    keys: ["del"],
    section: "Canvas",
    when: inCanvas,
    run: () => fire("opendesign:canvas.delete")
  },

  // Chat -------------------------------------------------------------------
  {
    id: "chat.send",
    title: "Send message",
    keys: ["cmd+enter"],
    section: "Chat",
    when: inChat,
    run: () => fire("opendesign:chat.send")
  },
  {
    id: "chat.cancel",
    title: "Cancel chat",
    keys: ["esc"],
    section: "Chat",
    when: inChat,
    run: () => fire("opendesign:chat.cancel")
  }
];

export function registerDefaults(): () => void {
  return registerMany(DEFAULT_SHORTCUTS);
}
