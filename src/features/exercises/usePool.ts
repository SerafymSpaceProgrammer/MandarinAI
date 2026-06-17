import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { supabase } from "@/api";
import { fetchTranslations } from "@/features/hsk/hsk";
import { fetchAllWords, type SavedWord } from "@/features/vocab/vocab";
import { logger } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";

// In-memory cache of fetched example sentences keyed by hanzi. Sentences
// never go stale, so we keep them as long as the process is alive even
// across screens.
const SENTENCE_CACHE = new Map<string, string>();

/**
 * Where exercise questions sample their words from.
 *
 *   • saved — the user's saved_words deck (classic SRS-aligned mode)
 *   • hsk   — public HSK words at the user's current `profile.hsk_level`
 *             (default fallback so a brand-new user with empty deck can
 *             still drill)
 *   • any   — top-frequency rows from the dictionary table (large pool,
 *             "no boundaries" mode)
 *
 * Persisted per-user across sessions in AsyncStorage.
 */
export type PoolMode = "saved" | "hsk" | "any";

const STORAGE_KEY = "@mandarinai/exercises/pool-mode:v1";
const DEFAULT_MODE: PoolMode = "hsk";

/**
 * Read the persisted mode synchronously is unsafe — AsyncStorage is async.
 * Callers see DEFAULT_MODE for one render, then the hook re-renders with
 * the persisted value. That's fine: the visible UI just snaps from the
 * default chip to the previously-chosen one in <50ms.
 */
export function usePoolMode(): {
  mode: PoolMode;
  setMode: (m: PoolMode) => void;
  hydrated: boolean;
} {
  const [mode, setModeState] = useState<PoolMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === "saved" || raw === "hsk" || raw === "any") setModeState(raw);
      })
      .finally(() => setHydrated(true));
  }, []);

  function setMode(m: PoolMode) {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch((err) =>
      logger.warn("usePoolMode persist", String(err)),
    );
  }
  return { mode, setMode, hydrated };
}

// ─────────────────────────────────────────────────────────────────────────
// Pool fetchers. All three return SavedWord-shaped objects so the existing
// `generateExercises()` can stay source-agnostic.
// ─────────────────────────────────────────────────────────────────────────

async function fetchSavedPool(userId: string, lang: string): Promise<SavedWord[]> {
  const words = await fetchAllWords(userId);
  if (words.length === 0 || lang === "en") return words;
  const map = await fetchTranslations(words.map((w) => w.hanzi), lang);
  return words.map((w) => {
    const translated = map[w.hanzi]?.[0];
    return translated ? { ...w, english: translated } : w;
  });
}

async function fetchHskPool(
  userId: string,
  lang: string,
  hskLevel: number,
): Promise<SavedWord[]> {
  // Cap "current level" at the boundaries of HSK 3.0 (1..9). For our common
  // case (level 1..6), filter by `hsk_new` first; fall back to `hsk_old` for
  // legacy users whose level only exists in the old syllabus.
  const { data, error } = await supabase
    .from("hsk_words")
    .select("hanzi, pinyin, hsk_new, hsk_old")
    .or(`hsk_new.eq.${hskLevel},hsk_old.eq.${hskLevel}`)
    .limit(400);
  if (error) {
    logger.warn("fetchHskPool", error.message);
    return [];
  }
  const rows = (data ?? []) as Array<{
    hanzi: string;
    pinyin: string;
    hsk_new: number | null;
    hsk_old: number | null;
  }>;
  if (rows.length === 0) return [];

  const map = await fetchTranslations(rows.map((r) => r.hanzi), lang);
  return rows.map((r) => toSavedShape({
    hanzi: r.hanzi,
    pinyin: r.pinyin,
    english: map[r.hanzi]?.[0] ?? "",
    hsk_level: r.hsk_new ?? r.hsk_old ?? 0,
    userId,
  }));
}

async function fetchAnyPool(userId: string, lang: string): Promise<SavedWord[]> {
  // Sorted by freq (lower = more common); restrict to entries where we
  // have a meaning in `lang` already cached, otherwise fall back to the
  // English meanings from the master row.
  const { data, error } = await supabase
    .from("dictionary")
    .select("hanzi, pinyin, hsk_level, meanings_en, freq")
    .order("freq", { ascending: true })
    .limit(500);
  if (error) {
    logger.warn("fetchAnyPool", error.message);
    return [];
  }
  const rows = (data ?? []) as Array<{
    hanzi: string;
    pinyin: string;
    hsk_level: number | null;
    meanings_en: string[];
    freq: number | null;
  }>;
  if (rows.length === 0) return [];

  // Pre-localise via the existing translation cache (hsk_word_translations
  // covers a lot; dictionary_translations could be hooked here later).
  const map = lang === "en"
    ? {}
    : await fetchTranslations(rows.map((r) => r.hanzi), lang);

  return rows.map((r) => toSavedShape({
    hanzi: r.hanzi,
    pinyin: r.pinyin,
    english: map[r.hanzi]?.[0] ?? r.meanings_en[0] ?? "",
    hsk_level: r.hsk_level ?? 0,
    userId,
  }));
}

/**
 * Build a SavedWord-compatible object from a (hanzi, pinyin, meaning, level)
 * tuple — the SRS metadata is zeroed since these are ephemeral cards that
 * never get persisted. Exercise generators don't read those fields anyway.
 */
function toSavedShape(opts: {
  hanzi: string;
  pinyin: string;
  english: string;
  hsk_level: number;
  userId: string;
}): SavedWord {
  return {
    user_id: opts.userId,
    hanzi: opts.hanzi,
    pinyin: opts.pinyin,
    english: opts.english,
    hsk_level: opts.hsk_level,
    saved_at: new Date(0).toISOString(),
    review_count: 0,
    srs_interval: 0,
    ease_factor: 2.5,
    next_review_at: new Date(0).toISOString(),
    context_sentence: null,
    updated_at: new Date(0).toISOString(),
  };
}

/**
 * Fetch (and cache) AI-generated example sentences for words that don't
 * carry their own `context_sentence`. Used by word-order and fill-blank
 * exercises when the pool comes from HSK / dictionary. Returns a map of
 * `hanzi → sentence`; words the model couldn't write a sentence for are
 * absent from the result (caller treats them as still-no-context).
 */
export async function fetchExampleSentences(
  hanzis: string[],
): Promise<Record<string, string>> {
  if (hanzis.length === 0) return {};
  const out: Record<string, string> = {};

  // Drain the in-memory cache first.
  const remaining: string[] = [];
  for (const h of hanzis) {
    const cached = SENTENCE_CACHE.get(h);
    if (cached) out[h] = cached;
    else remaining.push(h);
  }
  if (remaining.length === 0) return out;

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) return out;
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return out;

  // dict-examples caps each call at 20; chunk if the caller passed more.
  for (let i = 0; i < remaining.length; i += 20) {
    const slice = remaining.slice(i, i + 20);
    try {
      const res = await fetch(`${base}/functions/v1/dict-examples`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({ hanzi: slice }),
      });
      if (!res.ok) {
        logger.warn("dict-examples failed", res.status);
        continue;
      }
      const body = (await res.json()) as { results?: Record<string, string> };
      const map = body.results ?? {};
      for (const [k, v] of Object.entries(map)) {
        SENTENCE_CACHE.set(k, v);
        out[k] = v;
      }
    } catch (err) {
      logger.warn("dict-examples error", String(err));
    }
  }
  return out;
}

/**
 * Resolve the word pool for the given mode. Stages a fallback ladder when
 * the chosen mode is empty:
 *   saved → hsk → any
 *   hsk   → saved (if no HSK rows for the user's level) → any
 *   any   → empty (the dictionary table being empty is a deploy bug)
 *
 * Returns the **actual** mode used so the UI can flag the fallback to the
 * user ("we showed you HSK words because your deck is empty").
 */
export async function loadExercisePool(opts: {
  mode: PoolMode;
  userId: string;
  lang: string;
  hskLevel: number;
}): Promise<{ words: SavedWord[]; actualMode: PoolMode }> {
  const { mode, userId, lang, hskLevel } = opts;

  if (mode === "saved") {
    const saved = await fetchSavedPool(userId, lang);
    if (saved.length >= 4) return { words: saved, actualMode: "saved" };
    // Not enough — fall through.
  }
  if (mode === "hsk" || (mode === "saved" && true)) {
    const hsk = await fetchHskPool(userId, lang, hskLevel);
    if (hsk.length >= 4) return { words: hsk, actualMode: "hsk" };
  }
  const any = await fetchAnyPool(userId, lang);
  return { words: any, actualMode: "any" };
}

/**
 * Convenience React hook — wires `loadExercisePool` to component state with
 * cancellation on unmount and re-runs whenever the mode flips.
 */
export function useExercisePool(mode: PoolMode): {
  words: SavedWord[];
  actualMode: PoolMode;
  loading: boolean;
  reload: () => void;
} {
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const [words, setWords] = useState<SavedWord[]>([]);
  const [actualMode, setActualMode] = useState<PoolMode>(mode);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    loadExercisePool({
      mode,
      userId: session.user.id,
      lang: profile?.native_language ?? "en",
      hskLevel: profile?.hsk_level ?? 1,
    })
      .then((res) => {
        if (cancelled) return;
        setWords(res.words);
        setActualMode(res.actualMode);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, session?.user.id, profile?.native_language, profile?.hsk_level, tick]);

  return { words, actualMode, loading, reload: () => setTick((t) => t + 1) };
}
