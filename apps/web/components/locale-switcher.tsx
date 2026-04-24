"use client";

import { useLocale, useT, type Locale } from "../lib/i18n";

export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const t = useT();

  function handleChange(newLocale: Locale) {
    if (newLocale === currentLocale) return;

    try {
      window.localStorage.setItem("opendesign.locale", newLocale);
      document.cookie = `opendesign-locale=${newLocale}; path=/; max-age=31536000`;
    } catch {
      // localStorage or cookie blocked
    }

    // Simple reload — avoids hydration issues
    window.location.reload();
  }

  return (
    <div className="locale-switcher">
      <button
        type="button"
        className={`locale-button ${currentLocale === "en-US" ? "is-active" : ""}`}
        onClick={() => handleChange("en-US")}
        aria-label="Switch to English"
      >
        {t("locale.en")}
      </button>
      <button
        type="button"
        className={`locale-button ${currentLocale === "zh-CN" ? "is-active" : ""}`}
        onClick={() => handleChange("zh-CN")}
        aria-label="Switch to Chinese"
      >
        {t("locale.zh")}
      </button>
    </div>
  );
}
