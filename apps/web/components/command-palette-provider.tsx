"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { CommandPalette } from "./command-palette";
import { buildDefaultCommands } from "../lib/command-palette-actions";
import { useT } from "../lib/i18n";
import type { CommandAction } from "../lib/command-palette-types";

type CommandPaletteContextValue = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
  registerCommand: (command: CommandAction) => () => void;
  unregisterCommand: (id: string) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

type NavigateFn = (href: string) => void;

type CommandPaletteProviderProps = {
  children: ReactNode;
  /**
   * Navigation function. In real usage pass `useRouter().push` from a
   * client child — but since providers in Next.js App Router may live
   * outside a `<Suspense>`, callers can also inject their own.
   */
  navigate?: NavigateFn;
  /** Optional refresh hook (e.g. `useRouter().refresh`). */
  refresh?: () => void;
  /** Whether we're currently rendering inside a studio route. */
  inStudioRoute?: boolean;
  /** Override default commands if needed. */
  initialCommands?: CommandAction[];
};

function defaultNavigate(href: string) {
  if (typeof window !== "undefined") window.location.assign(href);
}

export function CommandPaletteProvider({
  children,
  navigate,
  refresh,
  inStudioRoute = false,
  initialCommands
}: CommandPaletteProviderProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [registered, setRegistered] = useState<CommandAction[]>([]);

  // Keep a stable ref to latest navigate for command closures.
  const navigateRef = useRef<NavigateFn>(navigate ?? defaultNavigate);
  useEffect(() => {
    navigateRef.current = navigate ?? defaultNavigate;
  }, [navigate]);

  const refreshRef = useRef<(() => void) | undefined>(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const close = useCallback(() => setIsOpen(false), []);
  const openPalette = useCallback(() => setIsOpen(true), []);
  const toggle = useCallback(() => setIsOpen((previous) => !previous), []);

  const registerCommand = useCallback((command: CommandAction) => {
    setRegistered((current) => {
      const without = current.filter((item) => item.id !== command.id);
      return [...without, command];
    });
    return () => {
      setRegistered((current) => current.filter((item) => item.id !== command.id));
    };
  }, []);

  const unregisterCommand = useCallback((id: string) => {
    setRegistered((current) => current.filter((item) => item.id !== id));
  }, []);

  // Global hotkey: cmd/ctrl+k.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isK = event.key === "k" || event.key === "K";
      if (!isK) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      // Avoid conflicting with browser keychords that include shift/alt.
      if (event.shiftKey || event.altKey) return;
      event.preventDefault();
      setIsOpen((previous) => !previous);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const defaults = useMemo(() => {
    if (initialCommands) return initialCommands;
    return buildDefaultCommands({
      navigate: (href) => navigateRef.current(href),
      refresh: () => refreshRef.current?.(),
      closePalette: close,
      studio: { inStudioRoute },
      t
    });
    // `close` is stable; `inStudioRoute` / `initialCommands` / `t` are the inputs.
  }, [close, inStudioRoute, initialCommands, t]);

  const commands = useMemo<CommandAction[]>(() => {
    const byId = new Map<string, CommandAction>();
    for (const command of defaults) byId.set(command.id, command);
    // Registered commands win over defaults with the same id.
    for (const command of registered) byId.set(command.id, command);
    return Array.from(byId.values());
  }, [defaults, registered]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open: openPalette,
      close,
      toggle,
      isOpen,
      registerCommand,
      unregisterCommand
    }),
    [close, isOpen, openPalette, registerCommand, toggle, unregisterCommand]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={isOpen} commands={commands} onClose={close} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  }
  return ctx;
}

/**
 * Hook helper for feature components to register a command while mounted.
 */
export function useRegisterCommand(command: CommandAction | null | undefined): void {
  const { registerCommand } = useCommandPalette();
  useEffect(() => {
    if (!command) return;
    return registerCommand(command);
  }, [command, registerCommand]);
}
