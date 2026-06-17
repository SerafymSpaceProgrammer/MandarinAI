import { supabase } from "@/api";
import { logger } from "@/lib/logger";
import { addWord, type SavedWord } from "@/features/vocab/vocab";

export type HskWord = {
  hanzi: string;
  pinyin: string;
  hsk_old: number | null;
  hsk_new: number | null;
  pos: string[] | null;
};

export type Syllabus = "old" | "new";

export const POS_TAGS = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "classifier",
  "particle",
  "pronoun",
  "conjunction",
  "preposition",
  "interjection",
  "number",
  "proper",
] as const;
export type PosTag = (typeof POS_TAGS)[number];

export const POS_LABELS: Record<PosTag, { label: string; emoji: string }> = {
  noun: { label: "Noun", emoji: "🅽" },
  verb: { label: "Verb", emoji: "🅥" },
  adjective: { label: "Adj.", emoji: "🅐" },
  adverb: { label: "Adv.", emoji: "🅡" },
  classifier: { label: "Classifier", emoji: "🅒" },
  particle: { label: "Particle", emoji: "🅟" },
  pronoun: { label: "Pronoun", emoji: "🆉" },
  conjunction: { label: "Conj.", emoji: "🅢" },
  preposition: { label: "Prep.", emoji: "🅠" },
  interjection: { label: "Interj.", emoji: "🅘" },
  number: { label: "Number", emoji: "#" },
  proper: { label: "Name", emoji: "𝐍" },
};

/**
 * Find HSK words that contain the given single hanzi as a component. Used by
 * the character detail page to show "Compounds" — i.e. real words where the
 * character appears, so the learner sees how the building block is used in
 * actual vocabulary.
 *
 * Sorted by HSK level ascending (cheapest = HSK 1) then by length and hanzi
 * so the most pedagogically useful examples surface first.
 */
export async function fetchWordsContaining(
  char: string,
  limit = 12,
): Promise<HskWord[]> {
  if (!char || [...char].length !== 1) return [];
  const { data, error } = await supabase
    .from("hsk_words")
    .select("hanzi, pinyin, hsk_old, hsk_new, pos")
    .ilike("hanzi", `%${char}%`)
    .neq("hanzi", char)
    .limit(200);
  if (error) {
    logger.warn("fetchWordsContaining error", error.message);
    return [];
  }
  // Defensive client-side filter: ilike is byte-level on some Postgres builds
  // and could return false positives if the char has uppercase/lowercase
  // ambiguity. Keep only rows that genuinely contain the char.
  const filtered = ((data ?? []) as HskWord[]).filter(
    (w) => [...w.hanzi].length > 1 && [...w.hanzi].includes(char),
  );
  filtered.sort((a, b) => {
    const la = a.hsk_new ?? a.hsk_old ?? 9;
    const lb = b.hsk_new ?? b.hsk_old ?? 9;
    if (la !== lb) return la - lb;
    if (a.hanzi.length !== b.hanzi.length) return a.hanzi.length - b.hanzi.length;
    return a.hanzi.localeCompare(b.hanzi);
  });
  return filtered.slice(0, limit);
}

/**
 * Pull the entire HSK catalog (both old + new syllabus rows) in one shot.
 * The table is ~6,300 rows × small columns ≈ a few hundred KB, so doing this
 * once per session is cheaper than streaming filtered queries for every
 * keystroke in the word-browser search box.
 *
 * The result is cached in a module-level variable; subsequent callers get the
 * already-resolved array. Callers that need a fresh fetch can pass `force`.
 */
let CATALOG_CACHE: HskWord[] | null = null;
let CATALOG_INFLIGHT: Promise<HskWord[]> | null = null;
export async function fetchAllCatalog(force = false): Promise<HskWord[]> {
  if (!force && CATALOG_CACHE) return CATALOG_CACHE;
  if (!force && CATALOG_INFLIGHT) return CATALOG_INFLIGHT;
  CATALOG_INFLIGHT = (async () => {
    const all: HskWord[] = [];
    const pageSize = 1000;
    let from = 0;
    // Supabase caps a single select at 1000 rows by default; page until empty.
    for (let i = 0; i < 20; i++) {
      const { data, error } = await supabase
        .from("hsk_words")
        .select("hanzi, pinyin, hsk_old, hsk_new, pos")
        .order("hanzi", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) {
        logger.warn("fetchAllCatalog error", error.message);
        break;
      }
      const rows = (data ?? []) as HskWord[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    CATALOG_CACHE = all;
    return all;
  })();
  try {
    return await CATALOG_INFLIGHT;
  } finally {
    CATALOG_INFLIGHT = null;
  }
}

/**
 * Normalise a pinyin string for substring matching. Strips combining tone
 * marks (`nǐ` → `ni`), the `ü` ligature, removes spaces and tone digits, and
 * lower-cases everything. Same function runs on both the user's query and on
 * the catalog rows so the comparison is symmetric.
 */
export function normalizePinyin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ü/gi, "u")
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Rank an HSK row against the user's query. Higher = better match. Returns
 * -1 when the row should be filtered out. Order of checks matches the user's
 * mental model: exact hanzi > exact pinyin > prefix > substring > meaning.
 *
 * `meaningHits` lets the caller score by a separately-loaded translation map
 * (we don't store meanings on `hsk_words`, so the caller is the translation
 * fetcher).
 */
export function scoreHskMatch(
  word: HskWord,
  rawQuery: string,
  normQuery: string,
  meaningHits: boolean,
): number {
  if (rawQuery.length === 0) return 0;
  const hanzi = word.hanzi;
  const pinyin = normalizePinyin(word.pinyin);
  if (hanzi === rawQuery) return 1000;
  if (pinyin === normQuery) return 800;
  if (hanzi.startsWith(rawQuery)) return 600;
  if (pinyin.startsWith(normQuery)) return 500;
  if (hanzi.includes(rawQuery)) return 400;
  if (pinyin.includes(normQuery)) return 300;
  if (meaningHits) return 200;
  return -1;
}

/**
 * Pull the catalog filtered by HSK level + syllabus. Sorted by hanzi.
 */
export async function fetchCatalog(
  syllabus: Syllabus,
  level: number,
  limit = 1000,
): Promise<HskWord[]> {
  const column = syllabus === "old" ? "hsk_old" : "hsk_new";
  const { data, error } = await supabase
    .from("hsk_words")
    .select("hanzi, pinyin, hsk_old, hsk_new, pos")
    .eq(column, level)
    .order("hanzi", { ascending: true })
    .limit(limit);

  if (error) {
    logger.warn("fetchCatalog error", error.message);
    return [];
  }
  return (data ?? []) as HskWord[];
}

export type Topic = {
  id: string;
  name: Record<string, string>;
  emoji: string | null;
  description: Record<string, string>;
  word_count?: number;
};

/**
 * All topics with their word counts (so the topic landing can show "412 words"
 * straight away). Sorted by count descending.
 */
export async function fetchTopics(): Promise<Topic[]> {
  const [topicsRes, countsRes] = await Promise.all([
    supabase
      .from("hsk_topics")
      .select("id, name, emoji, description"),
    supabase
      .from("hsk_word_topics")
      .select("topic_id"),
  ]);

  if (topicsRes.error) {
    logger.warn("fetchTopics error", topicsRes.error.message);
    return [];
  }
  const counts = new Map<string, number>();
  for (const r of (countsRes.data ?? []) as Array<{ topic_id: string }>) {
    counts.set(r.topic_id, (counts.get(r.topic_id) ?? 0) + 1);
  }

  const topics = (topicsRes.data ?? []) as Topic[];
  return topics
    .map((t) => ({ ...t, word_count: counts.get(t.id) ?? 0 }))
    .sort((a, b) => (b.word_count ?? 0) - (a.word_count ?? 0));
}

/**
 * Words tagged with a specific topic, optionally narrowed by HSK level.
 * Joins via hsk_word_topics through PostgREST's nested-select syntax so
 * it's a single round-trip.
 */
export async function fetchByTopic(
  topicId: string,
  options: { syllabus?: Syllabus; level?: number; limit?: number } = {},
): Promise<HskWord[]> {
  const { data, error } = await supabase
    .from("hsk_word_topics")
    .select("hanzi, hsk_words!inner(hanzi, pinyin, hsk_old, hsk_new, pos)")
    .eq("topic_id", topicId)
    .limit(options.limit ?? 1000);

  if (error) {
    logger.warn("fetchByTopic error", error.message);
    return [];
  }

  // Supabase wraps a nested-select result in an array even for many-to-one
  // joins. Pick the first (and only) element per row.
  let rows = ((data ?? []) as unknown as Array<{
    hsk_words: HskWord | HskWord[];
  }>)
    .map((r) => (Array.isArray(r.hsk_words) ? r.hsk_words[0] : r.hsk_words))
    .filter((w): w is HskWord => Boolean(w));

  if (options.syllabus && options.level) {
    const col = options.syllabus === "old" ? "hsk_old" : "hsk_new";
    rows = rows.filter((w) => w[col as keyof HskWord] === options.level);
  }

  return rows.sort((a, b) => a.hanzi.localeCompare(b.hanzi));
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
 * Bulk translate hanzi into the user's language.
 *
 * Fast path (lang === 'en'): pulls hand-curated CC-CEDICT translations
 *   directly from hsk_word_translations in a single SELECT — no edge
 *   function round-trip, no Google fallback needed.
 *
 * Other languages: falls through the translate-meaning edge function
 *   which checks the cache, then Google-translates the rest and writes
 *   them back. First user pays the latency, every subsequent caller hits
 *   cache.
 */
export async function fetchTranslations(
  hanzis: string[],
  lang: string,
): Promise<TranslationsByHanzi> {
  if (hanzis.length === 0) return {};

  // Direct DB read for English — every HSK word has a curated entry.
  if (lang === "en") {
    return await fetchCachedTranslations(hanzis, "en");
  }

  // Other languages: cache → edge fn for misses.
  const cached = await fetchCachedTranslations(hanzis, lang);
  const missing = hanzis.filter((h) => !cached[h] || cached[h].length === 0);
  if (missing.length === 0) return cached;

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return cached;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/translate-meaning`;
  const out: TranslationsByHanzi = { ...cached };

  for (let i = 0; i < missing.length; i += 50) {
    const slice = missing.slice(i, i + 50);
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

async function fetchCachedTranslations(
  hanzis: string[],
  lang: string,
): Promise<TranslationsByHanzi> {
  const out: TranslationsByHanzi = {};
  // Supabase URL filter accepts an `in.()` list; chunk to keep URL short.
  for (let i = 0; i < hanzis.length; i += 200) {
    const slice = hanzis.slice(i, i + 200);
    const { data, error } = await supabase
      .from("hsk_word_translations")
      .select("hanzi, meanings")
      .eq("lang", lang)
      .in("hanzi", slice);
    if (error) {
      logger.warn("fetchCachedTranslations error", error.message);
      continue;
    }
    for (const row of (data ?? []) as Array<{ hanzi: string; meanings: string[] }>) {
      out[row.hanzi] = row.meanings ?? [];
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
