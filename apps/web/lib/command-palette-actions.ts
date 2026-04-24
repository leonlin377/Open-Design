import type { CommandAction } from "./command-palette-types";
import type { Dictionary } from "./i18n/dictionary";

export type StudioContextFlags = {
  /** The palette is currently being rendered on a studio/[projectId] route. */
  inStudioRoute: boolean;
};

export type CommandPaletteActionDeps = {
  /** Next.js router push; typically `useRouter().push`. */
  navigate: (href: string) => void;
  /** Refresh the current route (optional — used by some commands). */
  refresh?: () => void;
  /** Close the palette after a command runs. */
  closePalette: () => void;
  /** Studio context detection so non-route commands can be disabled. */
  studio: StudioContextFlags;
  /**
   * Current document element reference for toggling theme classes.
   * Defaults to `document.documentElement`.
   */
  documentElement?: HTMLElement;
  /** Translation function. */
  t?: (key: keyof Dictionary) => string;
};

const DARK_CLASS = "dark";
const THEME_STORAGE_KEY = "opendesign:theme";

function toggleDarkMode(el: HTMLElement | undefined) {
  const root = el ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!root) return;
  const next = !root.classList.contains(DARK_CLASS);
  root.classList.toggle(DARK_CLASS, next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  } catch {
    /* storage unavailable — ignore */
  }
}

function dispatchStudioEvent(name: string, detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`opendesign:${name}`, { detail }));
}

export function buildDefaultCommands(deps: CommandPaletteActionDeps): CommandAction[] {
  const { navigate, closePalette, studio, documentElement, t } = deps;
  const studioOnly = !studio.inStudioRoute;

  // Fallback translations if t is not provided
  const getLabel = (key: keyof Dictionary, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const wrap = (fn: () => void | Promise<void>) => async () => {
    try {
      await fn();
    } finally {
      closePalette();
    }
  };

  return [
    // Navigation
    {
      id: "nav.projects",
      title: getLabel("command.nav.projects", "Go to projects"),
      subtitle: getLabel("command.nav.projects.subtitle", "Open the projects index"),
      section: "Navigation",
      shortcut: "g p",
      run: wrap(() => navigate("/projects"))
    },
    {
      id: "nav.signout",
      title: getLabel("command.nav.signout", "Sign out"),
      subtitle: getLabel("command.nav.signout.subtitle", "End the current session"),
      section: "Navigation",
      run: wrap(() => navigate("/auth/sign-out"))
    },
    {
      id: "nav.create-project",
      title: getLabel("command.nav.create_project", "Create project"),
      subtitle: getLabel("command.nav.create_project.subtitle", "Start a new OpenDesign project"),
      section: "Navigation",
      shortcut: "c p",
      run: wrap(() => navigate("/projects?new=1"))
    },

    // Studio
    {
      id: "studio.new-artifact",
      title: getLabel("command.studio.new_artifact", "New artifact"),
      subtitle: getLabel("command.studio.new_artifact.subtitle", "Add an artifact to the current project"),
      section: "Studio",
      shortcut: "n a",
      disabled: studioOnly,
      run: wrap(() => dispatchStudioEvent("studio:new-artifact"))
    },
    {
      id: "studio.focus-generate",
      title: getLabel("command.studio.focus_generate", "Focus generate panel"),
      subtitle: getLabel("command.studio.focus_generate.subtitle", "Jump to the prompt input"),
      section: "Studio",
      shortcut: "/",
      disabled: studioOnly,
      run: wrap(() => dispatchStudioEvent("studio:focus-generate"))
    },
    {
      id: "studio.toggle-chat",
      title: "Toggle chat panel", // i18n-skip: not user-facing in the palette
      subtitle: "Show or hide the conversational sidebar", // i18n-skip: not user-facing in the palette
      section: "Studio",
      shortcut: "⌘ /",
      disabled: studioOnly,
      run: wrap(() => dispatchStudioEvent("studio:toggle-chat"))
    },
    {
      id: "studio.zoom-in",
      title: "Zoom in", // i18n-skip: studio-only, minimal priority
      section: "Studio",
      shortcut: "⌘ +",
      disabled: studioOnly,
      run: wrap(() => dispatchStudioEvent("studio:zoom", { direction: "in" }))
    },
    {
      id: "studio.zoom-out",
      title: "Zoom out", // i18n-skip: studio-only, minimal priority
      section: "Studio",
      shortcut: "⌘ -",
      disabled: studioOnly,
      run: wrap(() => dispatchStudioEvent("studio:zoom", { direction: "out" }))
    },
    {
      id: "studio.fit-canvas",
      title: "Fit canvas to screen", // i18n-skip: studio-only, minimal priority
      subtitle: "Reset the viewport to fit all artifacts", // i18n-skip: studio-only, minimal priority
      section: "Studio",
      shortcut: "⌘ 0",
      disabled: studioOnly,
      run: wrap(() => dispatchStudioEvent("studio:fit-canvas"))
    },

    // Theme
    {
      id: "theme.toggle-dark",
      title: getLabel("command.theme.toggle", "Toggle dark mode"),
      subtitle: getLabel("command.theme.toggle.subtitle", "Switch between light and dark theme"),
      section: "Theme",
      shortcut: "⌘ ⇧ D",
      run: wrap(() => toggleDarkMode(documentElement))
    },

    // Help
    {
      id: "help.shortcuts",
      title: "Open keyboard shortcuts", // i18n-skip: help section, secondary priority
      subtitle: "Reference of all hotkeys", // i18n-skip: help section, secondary priority
      section: "Help",
      shortcut: "?",
      run: wrap(() => dispatchStudioEvent("help:open-shortcuts"))
    }
  ];
}
