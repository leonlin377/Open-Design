"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { createPortal } from "react-dom";
import { COMMAND_SECTIONS } from "../lib/command-palette-types";
import type { CommandAction, CommandSection } from "../lib/command-palette-types";

type CommandPaletteProps = {
  open: boolean;
  commands: CommandAction[];
  onClose: () => void;
};

type ScoredCommand = {
  command: CommandAction;
  score: number;
};

/**
 * Lightweight fuzzy ranking: combines substring hits with tokenised matches
 * against title + subtitle + section. Zero deps, good enough at this scope.
 */
function scoreCommand(query: string, command: CommandAction): number {
  const haystackParts = [command.title, command.subtitle ?? "", command.section];
  const haystack = haystackParts.join(" ").toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;

  let score = 0;

  // Full substring match — highest weight.
  const directIndex = haystack.indexOf(needle);
  if (directIndex >= 0) {
    score += 100 - Math.min(directIndex, 50);
    // Prefer matches that start the title.
    if (command.title.toLowerCase().startsWith(needle)) score += 40;
  }

  // Tokenised matches: every query token must appear somewhere.
  const tokens = needle.split(/\s+/).filter(Boolean);
  let tokenHits = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) tokenHits += 1;
  }
  if (tokens.length > 0 && tokenHits === tokens.length) {
    score += 20 + tokenHits * 5;
  } else if (tokens.length > 0 && tokenHits === 0) {
    // No hit at all — drop it.
    return 0;
  } else {
    score += tokenHits * 3;
  }

  // Subsequence bonus — letters of the query appearing in order.
  let cursor = 0;
  for (const ch of needle) {
    const next = haystack.indexOf(ch, cursor);
    if (next < 0) {
      // Incomplete subsequence — don't bonus, but leave any prior score.
      cursor = -1;
      break;
    }
    cursor = next + 1;
  }
  if (cursor > 0) score += 5;

  return score;
}

function groupBySection(items: ScoredCommand[]): Map<CommandSection, ScoredCommand[]> {
  const map = new Map<CommandSection, ScoredCommand[]>();
  for (const section of COMMAND_SECTIONS) map.set(section, []);
  for (const entry of items) {
    const bucket = map.get(entry.command.section);
    if (bucket) bucket.push(entry);
  }
  return map;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(10, 12, 18, 0.55)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingTop: "12vh",
  zIndex: 1000
};

const panelStyle: CSSProperties = {
  width: "min(640px, calc(100vw - 32px))",
  maxHeight: "70vh",
  background: "var(--surface, #14161c)",
  color: "var(--surface-foreground, #f1f3f8)",
  borderRadius: 12,
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)"
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "16px 20px",
  fontSize: 16,
  background: "transparent",
  color: "inherit",
  border: "none",
  outline: "none",
  borderBottom: "1px solid rgba(255,255,255,0.08)"
};

const listStyle: CSSProperties = {
  margin: 0,
  padding: 8,
  overflowY: "auto",
  listStyle: "none",
  flex: 1
};

const sectionHeaderStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
  padding: "10px 12px 4px"
};

function itemStyle(active: boolean, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    background: active ? "rgba(99, 132, 255, 0.18)" : "transparent",
    color: disabled ? "rgba(255,255,255,0.4)" : "inherit",
    gap: 12
  };
}

const hintStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
  whiteSpace: "nowrap"
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
  marginTop: 2
};

const emptyStyle: CSSProperties = {
  padding: "28px 20px",
  textAlign: "center",
  color: "rgba(255,255,255,0.55)",
  fontSize: 13
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset when re-opening.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      previouslyFocused.current =
        (typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null);
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus?.();
      previouslyFocused.current = null;
    }
  }, [open]);

  // Autofocus input once the panel mounts.
  useLayoutEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const scored = useMemo<ScoredCommand[]>(() => {
    const entries = commands
      .map((command) => ({ command, score: scoreCommand(query, command) }))
      .filter((entry) => entry.score > 0);
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.command.title.localeCompare(b.command.title);
    });
    return entries;
  }, [commands, query]);

  // Flattened visible list (respecting section order) for keyboard navigation.
  const grouped = useMemo(() => groupBySection(scored), [scored]);
  const flatRunnable = useMemo<CommandAction[]>(() => {
    const out: CommandAction[] = [];
    for (const section of COMMAND_SECTIONS) {
      const bucket = grouped.get(section);
      if (!bucket) continue;
      for (const entry of bucket) out.push(entry.command);
    }
    return out;
  }, [grouped]);

  // Keep active index within bounds as results change.
  useEffect(() => {
    setActiveIndex((current) => {
      if (flatRunnable.length === 0) return 0;
      if (current >= flatRunnable.length) return 0;
      return current;
    });
  }, [flatRunnable]);

  const runCommand = useCallback(
    (command: CommandAction | undefined) => {
      if (!command || command.disabled) return;
      void command.run();
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        // Tab is disabled inside the palette per spec.
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (flatRunnable.length === 0) return 0;
          return (current + 1) % flatRunnable.length;
        });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (flatRunnable.length === 0) return 0;
          return (current - 1 + flatRunnable.length) % flatRunnable.length;
        });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runCommand(flatRunnable[activeIndex]);
      }
    },
    [activeIndex, flatRunnable, onClose, runCommand]
  );

  // Focus trap — keep focus inside panel even for programmatic moves.
  useEffect(() => {
    if (!open) return;
    const onFocus = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.target instanceof Node && !panel.contains(event.target)) {
        event.stopPropagation();
        const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        (focusable[0] ?? inputRef.current)?.focus();
      }
    };
    document.addEventListener("focusin", onFocus, true);
    return () => document.removeEventListener("focusin", onFocus, true);
  }, [open]);

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  if (!open || !mounted) return null;

  const overlay = (
    <div
      role="presentation"
      style={overlayStyle}
      onMouseDown={handleBackdropClick}
      data-command-palette-overlay
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={panelStyle}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a command or search…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={inputStyle}
          aria-label="Search commands"
          aria-autocomplete="list"
          aria-controls="command-palette-list"
          autoComplete="off"
          spellCheck={false}
        />
        <ul id="command-palette-list" role="listbox" style={listStyle}>
          {flatRunnable.length === 0 ? (
            <li style={emptyStyle}>No matching commands.</li>
          ) : (
            COMMAND_SECTIONS.map((section) => {
              const bucket = grouped.get(section);
              if (!bucket || bucket.length === 0) return null;
              return (
                <li key={section} aria-label={section}>
                  <div style={sectionHeaderStyle}>{section}</div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {bucket.map((entry) => {
                      const command = entry.command;
                      const flatIndex = flatRunnable.indexOf(command);
                      const active = flatIndex === activeIndex;
                      return (
                        <li
                          key={command.id}
                          role="option"
                          aria-selected={active}
                          aria-disabled={command.disabled || undefined}
                          style={itemStyle(active, Boolean(command.disabled))}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onMouseDown={(event) => {
                            // Prevent input blur before click fires.
                            event.preventDefault();
                          }}
                          onClick={() => runCommand(command)}
                        >
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{command.title}</span>
                            {command.subtitle ? (
                              <span style={subtitleStyle}>{command.subtitle}</span>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {command.hint ? <span style={hintStyle}>{command.hint}</span> : null}
                            {command.shortcut ? (
                              <kbd
                                style={{
                                  ...hintStyle,
                                  border: "1px solid rgba(255,255,255,0.14)",
                                  borderRadius: 4,
                                  padding: "2px 6px",
                                  fontFamily:
                                    "ui-monospace, SFMono-Regular, Menlo, monospace"
                                }}
                              >
                                {command.shortcut}
                              </kbd>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

export default CommandPalette;
