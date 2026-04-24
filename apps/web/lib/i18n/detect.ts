import { headers } from "next/headers";

export type Locale = "en-US" | "zh-CN";

/**
 * Parse Accept-Language header and return the best matching locale.
 * Prefers zh-CN if Chinese is present, otherwise defaults to en-US.
 */
function parseAcceptLanguage(header: string): Locale {
  const parts = header.split(",").map((part) => {
    const [lang, q] = part.trim().split(";");
    const quality = q ? parseFloat(q.replace("q=", "")) : 1;
    return { lang: lang.trim().toLowerCase(), quality };
  });

  parts.sort((a, b) => b.quality - a.quality);

  for (const { lang } of parts) {
    // Match zh variants (zh, zh-cn, zh-hans, etc.)
    if (lang.startsWith("zh")) return "zh-CN";
  }

  return "en-US";
}

/**
 * Server-side locale detection. Reads in order:
 * 1. opendesign-locale cookie
 * 2. Accept-Language header
 * 3. Default en-US
 */
export async function detectLocaleServer(): Promise<Locale> {
  try {
    const headersList = await headers();

    // Check cookie first
    const cookieHeader = headersList.get("cookie") || "";
    const cookieMatch = cookieHeader.match(/opendesign-locale=([^;]+)/);
    if (cookieMatch) {
      const locale = cookieMatch[1];
      if (locale === "en-US" || locale === "zh-CN") return locale;
    }

    // Fall back to Accept-Language
    const acceptLanguage = headersList.get("accept-language") || "";
    if (acceptLanguage) {
      return parseAcceptLanguage(acceptLanguage);
    }

    return "en-US";
  } catch {
    return "en-US";
  }
}

/**
 * Client-side locale detection. Reads in order:
 * 1. localStorage opendesign.locale
 * 2. navigator.language or browser default
 */
export function detectLocaleClient(): Locale {
  if (typeof window === "undefined") return "en-US";

  try {
    const stored = window.localStorage.getItem("opendesign.locale");
    if (stored === "en-US" || stored === "zh-CN") return stored;
  } catch {
    // localStorage blocked
  }

  try {
    const lang = navigator.language?.toLowerCase() || "";
    if (lang.startsWith("zh")) return "zh-CN";
  } catch {
    // navigator access blocked
  }

  return "en-US";
}
