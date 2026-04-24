"use client";

import { LocaleProvider, type Locale } from "../lib/i18n";

export function I18nProvider({
  initialLocale,
  children
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider locale={initialLocale}>
      {children}
    </LocaleProvider>
  );
}
