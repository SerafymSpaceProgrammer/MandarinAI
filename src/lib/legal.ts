import * as WebBrowser from "expo-web-browser";

import type { NativeLanguage } from "@/types";

/**
 * Legal pages live on the marketing site (mandarin-suite-landing repo,
 * next-intl with localePrefix "as-needed": English is served at the bare
 * path, other locales under /{locale}/…). App Review requires working
 * Privacy Policy and Terms links inside the app.
 */
const BASE_URL = "https://mandarinsuite.app";

export function legalUrl(page: "privacy" | "terms", lang?: NativeLanguage): string {
  const prefix = !lang || lang === "en" ? "" : `/${lang}`;
  return `${BASE_URL}${prefix}/${page}`;
}

export function openLegal(page: "privacy" | "terms", lang?: NativeLanguage): void {
  void WebBrowser.openBrowserAsync(legalUrl(page, lang));
}
