import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useUserStore } from "@/stores/userStore";
import type { NativeLanguage } from "@/types";

import { STRINGS, type Translations } from "./strings";

const FALLBACK: NativeLanguage = "en";

type I18nValue = {
  lang: NativeLanguage;
  t: Translations;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Resolves the active UI language. Falls back through:
 *   profile.native_language → 'en'
 * The dictionary is constructed once per language change so re-renders are
 * cheap (just a context update).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const profileLang = useUserStore((s) => s.profile?.native_language);
  const lang: NativeLanguage = (profileLang as NativeLanguage) ?? FALLBACK;

  const value = useMemo<I18nValue>(() => {
    const t = (STRINGS[lang] ?? STRINGS[FALLBACK]) as Translations;
    return { lang, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translations {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Allow usage outside the provider (e.g. tests) by falling back to EN.
    return STRINGS[FALLBACK] as Translations;
  }
  return ctx.t;
}

export function useLang(): NativeLanguage {
  const ctx = useContext(I18nContext);
  return ctx?.lang ?? FALLBACK;
}
