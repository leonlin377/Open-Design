"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "opendesign.theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  // When the user leaves the choice on `system` we want `data-theme` to stay
  // as `system` (globals.css then uses prefers-color-scheme). No extra
  // listener needed; the media query handles repaints on its own.

  function handleClick() {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length] ?? "system";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private-browsing mode, etc. Prefer silent failure over blocking the UI.
    }
  }

  const label =
    theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  // Render a stable button label on the server to avoid hydration flicker.
  const renderedLabel = mounted ? label : "Theme";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-label={`Theme: ${renderedLabel}. Click to switch.`}
      title="Switch between system, light, and dark"
    >
      <span className="theme-toggle-dot" aria-hidden="true" />
      {renderedLabel}
    </button>
  );
}
