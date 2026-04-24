"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { Locale } from "./detect";
import { dictionaries, type Dictionary } from "./dictionary";

const LocaleContext = createContext<Locale | null>(null);

/**
 * Provider component that wraps the app with locale context.
 * Must be a client component to support useContext.
 */
export function LocaleProvider({
  locale,
  children
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Hook to get the current locale.
 */
export function useLocale(): Locale {
  const locale = useContext(LocaleContext);
  if (!locale) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return locale;
}

/**
 * Hook to get the translation function for the current locale.
 */
export function useT() {
  const locale = useLocale();
  const dict = dictionaries[locale];

  return useMemo(() => {
    return (key: keyof Dictionary, vars?: Record<string, string>): string => {
      let text = dict[key] as string;
      if (!text) {
        console.warn(`Missing translation for key: ${String(key)} in locale: ${locale}`);
        return String(key);
      }

      // Simple {{variable}} interpolation
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(`{{${name}}}`, value);
        }
      }

      return text;
    };
  }, [dict, locale]);
}

/**
 * Format a date according to the current locale.
 */
export function formatDate(date: Date | number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/**
 * Format relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(
  date: Date | number,
  locale: Locale
): string {
  const now = Date.now();
  const time = typeof date === "number" ? date : date.getTime();
  const diff = Math.floor((now - time) / 1000); // seconds

  const rtf = new Intl.RelativeTimeFormat(
    locale === "zh-CN" ? "zh-CN" : "en-US",
    { numeric: "auto" }
  );

  if (diff < 60) {
    return rtf.format(-diff, "second");
  } else if (diff < 3600) {
    return rtf.format(-Math.floor(diff / 60), "minute");
  } else if (diff < 86400) {
    return rtf.format(-Math.floor(diff / 3600), "hour");
  } else if (diff < 604800) {
    return rtf.format(-Math.floor(diff / 86400), "day");
  } else if (diff < 2592000) {
    return rtf.format(-Math.floor(diff / 604800), "week");
  } else {
    return rtf.format(-Math.floor(diff / 2592000), "month");
  }
}

export type { Locale, Dictionary };
