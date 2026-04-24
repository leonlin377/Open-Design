"use client";

/**
 * Client-side provider shell. `app/layout.tsx` is a server component so it
 * cannot call `useRouter` / `usePathname` directly; this component lives in
 * between to thread real navigation into the global command palette and to
 * mount the keyboard-shortcut listener once per document.
 */

import type { ReactNode } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { KeyboardShortcutProvider } from "../components/keyboard-shortcut-provider";
import { CommandPaletteProvider } from "../components/command-palette-provider";
import { PaperGrain } from "../components/paper-grain";
import { I18nProvider } from "./i18n-provider";
import type { Locale } from "../lib/i18n";

export function ClientProviders({
  children,
  initialLocale
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const inStudioRoute = pathname.startsWith("/studio/");

  return (
    <I18nProvider initialLocale={initialLocale}>
      <PaperGrain />
      <KeyboardShortcutProvider>
        <CommandPaletteProvider
          // The command palette collects raw URL strings from its registry;
          // typedRoutes only validates literal routes so we cast at the
          // boundary — the input is user-facing and runtime-validated.
          navigate={(href) => router.push(href as Route)}
          refresh={() => router.refresh()}
          inStudioRoute={inStudioRoute}
        >
          {children}
        </CommandPaletteProvider>
      </KeyboardShortcutProvider>
    </I18nProvider>
  );
}
