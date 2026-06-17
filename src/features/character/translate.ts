import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { supabase } from "@/api";
import { fetchTranslations } from "@/features/hsk/hsk";
import { logger } from "@/lib/logger";

/**
 * Translate a character's mnemonic (stored only in EN in characters_dict)
 * into the user's native language. Hits an AsyncStorage cache keyed by
 * (hanzi, lang) so re-opens are instant. Falls back to the original EN text
 * when the network call fails — better to show stale English than a blank
 * card.
 */
export async function translateMnemonic(
  hanzi: string,
  textEn: string,
  lang: string,
): Promise<string> {
  if (!textEn.trim()) return textEn;
  if (lang === "en") return textEn;

  const cacheKey = `@mandarinai/mnemonic:${lang}:${hanzi}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch {
    // Ignore — fall through to network fetch.
  }

  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return textEn;

    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/translate-meaning`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ text: textEn, lang }),
    });
    if (!res.ok) return textEn;
    const body = (await res.json()) as { translated?: string };
    const translated = body.translated?.trim();
    if (!translated) return textEn;

    AsyncStorage.setItem(cacheKey, translated).catch(() => {});
    return translated;
  } catch (err) {
    logger.warn("translateMnemonic error", err);
    return textEn;
  }
}

export type LocalizedCharacter = {
  meanings: string[];
  mnemonic: string;
  loading: boolean;
};

/**
 * Reactive localizer for a single character's English-stored fields. Returns
 * the EN originals immediately, then swaps in localized copies once the
 * translation calls finish. Each step component (Learn / Recognize /
 * Produce / Mastered) wires this in so the prompt prose stays in sync with
 * the user's UI language.
 */
export function useLocalizedCharacter(
  hanzi: string,
  meaningsEn: string[],
  mnemonicEn: string | null,
  lang: string,
): LocalizedCharacter {
  const [meanings, setMeanings] = useState<string[]>(meaningsEn);
  const [mnemonic, setMnemonic] = useState<string>(mnemonicEn ?? "");
  const [loading, setLoading] = useState(lang !== "en");

  useEffect(() => {
    if (lang === "en") {
      setMeanings(meaningsEn);
      setMnemonic(mnemonicEn ?? "");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMeanings(meaningsEn);
    setMnemonic(mnemonicEn ?? "");

    (async () => {
      try {
        const [translated, mn] = await Promise.all([
          fetchTranslations([hanzi], lang)
            .then((r) => r[hanzi] ?? null)
            .catch(() => null),
          mnemonicEn
            ? translateMnemonic(hanzi, mnemonicEn, lang).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (translated && translated.length > 0) setMeanings(translated);
        if (mn) setMnemonic(mn);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // meaningsEn / mnemonicEn are derived from `dict` and stable across
    // re-renders for the same hanzi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hanzi, lang]);

  return { meanings, mnemonic, loading };
}
