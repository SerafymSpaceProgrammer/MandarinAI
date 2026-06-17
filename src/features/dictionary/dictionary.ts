import { supabase } from "@/api";
import { logger } from "@/lib/logger";

/**
 * A single dictionary entry as returned by `dict-search` (CEDICT-backed) or
 * `dict-ai-fallback` (OpenAI synthetic). The two sources are kept
 * interchangeable on purpose — the UI renders them as plain result cards.
 */
export type DictEntry = {
  hanzi: string;
  pinyin: string;
  /** Meanings in the user's native language when cached; else English. */
  meanings: string[];
  /** Always English (canonical CEDICT meanings or GPT's English fallback). */
  meanings_en: string[];
  hsk_level: number | null;
  freq: number | null;
  score: number;
  source_lang: string;
  /** "cedict" for normal rows, "ai" when produced by dict-ai-fallback. */
  source?: "cedict" | "ai";
};

const FN_SEARCH = "dict-search";
const FN_AI = "dict-ai-fallback";

function fnUrl(name: string): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/functions/v1/${name}`;
}

async function authedFetch(name: string, payload: unknown): Promise<unknown | null> {
  const url = fnUrl(name);
  if (!url) return null;
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn(`${name} failed`, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    logger.warn(`${name} error`, String(err));
    return null;
  }
}

/**
 * Cross-language dictionary search. Returns up to `max` entries ranked by
 * server-side scoring. Empty `q` yields `[]` (caller can show an empty
 * state); errors also yield `[]` so the UI never has to handle a failure
 * case in the render path.
 */
export async function searchDictionary(
  q: string,
  lang: string,
  max = 30,
): Promise<{ results: DictEntry[]; translatedQuery: string | null }> {
  const query = q.trim();
  if (query.length === 0) {
    return { results: [], translatedQuery: null };
  }
  const body = (await authedFetch(FN_SEARCH, { q: query, lang, max })) as
    | { results: DictEntry[]; translated_query: string | null }
    | null;
  if (!body) return { results: [], translatedQuery: null };
  return {
    results: (body.results ?? []).map((r) => ({ ...r, source: "cedict" as const })),
    translatedQuery: body.translated_query ?? null,
  };
}

/**
 * AI fallback. Called when the CEDICT-backed search returns nothing of
 * value (typically because the user typed a name, neologism or loanword
 * that isn't in the dictionary). Producing one entry costs an OpenAI
 * round-trip (~$0.0002 with gpt-4o-mini) and ~1s of latency, so callers
 * should debounce and only invoke after the user pauses typing.
 */
export async function aiFallbackLookup(
  q: string,
  lang: string,
): Promise<DictEntry | null> {
  const query = q.trim();
  if (query.length === 0) return null;
  const body = (await authedFetch(FN_AI, { q: query, lang })) as
    | { result: (DictEntry & { source?: "ai" }) | null }
    | null;
  if (!body?.result) return null;
  return { ...body.result, source: "ai" as const };
}
