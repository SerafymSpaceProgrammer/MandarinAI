import { supabase } from "@/api";
import { logger } from "@/lib/logger";
import { addWord, type SavedWord } from "@/features/vocab/vocab";

export type HskWord = {
  hanzi: string;
  pinyin: string;
  hsk_old: number | null;
  hsk_new: number | null;
};

export type Syllabus = "old" | "new";

/**
 * Pull the catalog filtered by HSK level + syllabus. Sorted by hanzi length
 * (single chars first) then by hanzi for predictability.
 */
export async function fetchCatalog(
  syllabus: Syllabus,
  level: number,
  limit = 1000,
): Promise<HskWord[]> {
  const column = syllabus === "old" ? "hsk_old" : "hsk_new";
  const { data, error } = await supabase
    .from("hsk_words")
    .select("hanzi, pinyin, hsk_old, hsk_new")
    .eq(column, level)
    .order("hanzi", { ascending: true })
    .limit(limit);

  if (error) {
    logger.warn("fetchCatalog error", error.message);
    return [];
  }
  return (data ?? []) as HskWord[];
}

export async function countByLevel(
  syllabus: Syllabus,
): Promise<Map<number, number>> {
  const column = syllabus === "old" ? "hsk_old" : "hsk_new";
  const { data, error } = await supabase
    .from("hsk_words")
    .select(column)
    .not(column, "is", null);

  if (error) {
    logger.warn("countByLevel error", error.message);
    return new Map();
  }

  const counts = new Map<number, number>();
  for (const row of (data ?? []) as Array<Record<string, number | null>>) {
    const v = row[column];
    if (typeof v !== "number") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

export type TranslationsByHanzi = Record<string, string[]>;

/**
 * Bulk translate up to 50 hanzi into the user's language. The edge function
 * checks `hsk_word_translations` first; misses are fetched from Google
 * Translate and written back, so subsequent calls hit cache.
 */
export async function fetchTranslations(
  hanzis: string[],
  lang: string,
): Promise<TranslationsByHanzi> {
  if (hanzis.length === 0) return {};

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return {};

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/translate-meaning`;
  const out: TranslationsByHanzi = {};

  // Cap per request at 50 so we don't time out the function.
  for (let i = 0; i < hanzis.length; i += 50) {
    const slice = hanzis.slice(i, i + 50);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({ hanzis: slice, lang }),
      });
      if (!res.ok) {
        logger.warn("translate-meaning batch failed", res.status);
        continue;
      }
      const body = (await res.json()) as {
        results: Record<string, { meanings: string[] }>;
      };
      for (const [h, v] of Object.entries(body.results ?? {})) {
        out[h] = v.meanings ?? [];
      }
    } catch (err) {
      logger.warn("translate-meaning batch error", err);
    }
  }
  return out;
}

/**
 * Read the user's saved hanzi so the catalog screen can render
 * "already saved" indicators next to the relevant rows.
 */
export async function fetchSavedHanziSet(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("saved_words")
    .select("hanzi")
    .eq("user_id", userId);
  if (error) {
    logger.warn("fetchSavedHanziSet error", error.message);
    return new Set();
  }
  return new Set(((data ?? []) as Array<{ hanzi: string }>).map((r) => r.hanzi));
}

/**
 * Save a list of HSK words to the user's deck in one go. Each row goes
 * through the existing addWord helper (upsert with `ignoreDuplicates: false`)
 * so previously-saved words keep their review history. Returns count of new
 * additions (not pre-existing).
 */
export async function bulkAddToDeck(
  userId: string,
  words: Array<{ hanzi: string; pinyin: string; meaning: string; hsk_level: number }>,
): Promise<{ added: number }> {
  let added = 0;
  for (const w of words) {
    const result = await addWord({
      userId,
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      english: w.meaning,
      hskLevel: w.hsk_level,
    });
    if (result) added += 1;
  }
  return { added };
}

/**
 * Convert HskWord + meaning into a SavedWord-shape used by the review
 * runner's "practice now" mode (where rows aren't persisted).
 */
export function asEphemeralCard(
  w: HskWord,
  meaning: string,
  userId: string,
): SavedWord {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    english: meaning,
    hsk_level: w.hsk_new ?? w.hsk_old ?? 0,
    saved_at: now,
    review_count: 0,
    srs_interval: 1,
    ease_factor: 2.5,
    next_review_at: now,
    context_sentence: null,
    updated_at: now,
  };
}
