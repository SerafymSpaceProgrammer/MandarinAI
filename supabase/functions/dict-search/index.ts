// dict-search — MandarinAI edge function
//
// Cross-language search over the `dictionary` table (CC-CEDICT, ~125k entries
// + non-HSK extras). Single endpoint that handles three inputs:
//
//   1. Hanzi:    "你好"        → exact / prefix / substring matches
//   2. Pinyin:   "ni hao" / "nǐhǎo" → pinyin_norm match
//   3. Native:   "hello" / "привет" → translates query to English via the
//                free Google Translate endpoint, then searches meanings_en
//
// Localised meanings (rendered in the user's `lang`) come from the
// `dictionary_translations` cache; if missing, the function fires off a
// best-effort lazy fill via Google Translate in the background and returns
// English meanings to the client. Subsequent searches hit the cache.
//
// Deployed with --no-verify-jwt; verifies the caller manually against
// GoTrue /user (ES256 gateway gotcha).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SUPPORTED_LANGS = new Set([
  "en", "es", "pt", "ru", "zh", "uk", "de", "pl",
]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function verifyJwt(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id: string };
  return { userId: user.id };
}

function normalizePinyin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ü/gi, "u")
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isCJK(s: string): boolean {
  return /[一-鿿]/.test(s);
}

async function googleTranslate(text: string, sl: string, tl: string): Promise<string | null> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as unknown[];
    const segments = (data[0] as Array<[string, string]>) ?? [];
    const joined = segments
      .map((s) => (Array.isArray(s) ? String(s[0] ?? "") : ""))
      .join("")
      .trim();
    return joined || null;
  } catch {
    return null;
  }
}

type DictRow = {
  hanzi: string;
  pinyin: string;
  meanings: string[];
  meanings_en: string[];
  hsk_level: number | null;
  freq: number | null;
  score: number;
  source_lang: string;
};

async function searchRpc(q: string, lang: string, max: number): Promise<DictRow[]> {
  const qNorm = normalizePinyin(q);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_dictionary`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q,
      q_norm: qNorm,
      lang,
      max_results: max,
    }),
  });
  if (!res.ok) return [];
  return (await res.json()) as DictRow[];
}

/**
 * For rows where we returned English meanings (source_lang === 'en' but
 * user wanted something else), lazily kick off a translation pass and
 * upsert into dictionary_translations. We don't await this — the user
 * gets English now, the next caller sees their native language.
 */
async function backfillTranslations(rows: DictRow[], lang: string): Promise<void> {
  if (lang === "en") return;
  const need = rows.filter((r) => r.source_lang === "en").slice(0, 20);
  for (const row of need) {
    // Translate the joined " · "-separated meaning string in one shot — Google
    // preserves the separator most of the time, which we then re-split.
    const joined = row.meanings_en.slice(0, 6).join(" · ");
    if (!joined) continue;
    const tr = await googleTranslate(joined, "en", lang);
    if (!tr) continue;
    const parts = tr.split(/[·;／/]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
    if (parts.length === 0) continue;
    await fetch(
      `${SUPABASE_URL}/rest/v1/dictionary_translations?on_conflict=hanzi,lang`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([
          { hanzi: row.hanzi, lang, meanings: parts, source: "auto" },
        ]),
      },
    ).catch(() => undefined);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const user = await verifyJwt(req);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as
    | { q?: string; lang?: string; max?: number }
    | null;
  if (!body || typeof body.q !== "string") {
    return jsonResponse({ error: "missing_query" }, 400);
  }

  const lang = (body.lang ?? "en").toLowerCase();
  if (!SUPPORTED_LANGS.has(lang)) {
    return jsonResponse({ error: "unsupported_lang", lang }, 400);
  }

  const max = Math.min(Math.max(body.max ?? 30, 1), 60);
  const rawQuery = body.q.trim();
  if (rawQuery.length === 0) return jsonResponse({ results: [], translated: null });

  // First pass — search verbatim. Covers hanzi + pinyin queries instantly,
  // and English/native queries that happen to map to an English meaning
  // substring already in our table (good for Latin-script lookups even
  // before translation).
  let rows = await searchRpc(rawQuery, lang, max);

  let translatedQuery: string | null = null;
  // If the query is non-CJK AND we got few hits, translate to EN and retry.
  if (!isCJK(rawQuery) && rows.length < 5) {
    // For latin/cyrillic queries — translate to English, then re-search.
    // Skip when query is obviously pinyin (only ascii + spaces) since the
    // first pass already handled that via pinyin_norm.
    const looksLikePinyin = /^[a-zA-Züu:\d\s]+$/i.test(rawQuery) && rawQuery.length <= 20;
    if (!looksLikePinyin || lang !== "en") {
      const en = await googleTranslate(rawQuery, lang === "en" ? "auto" : lang, "en");
      if (en && en.toLowerCase() !== rawQuery.toLowerCase()) {
        translatedQuery = en;
        const second = await searchRpc(en, lang, max);
        // Merge by hanzi, keep best score from either pass.
        const byHanzi = new Map<string, DictRow>(rows.map((r) => [r.hanzi, r]));
        for (const r of second) {
          const ex = byHanzi.get(r.hanzi);
          if (!ex || ex.score < r.score) byHanzi.set(r.hanzi, r);
        }
        rows = Array.from(byHanzi.values())
          .sort((a, b) => b.score - a.score || (a.freq ?? 9999) - (b.freq ?? 9999))
          .slice(0, max);
      }
    }
  }

  // Fire-and-forget backfill — runs after we've already replied to the
  // caller, hydrating dictionary_translations for the next user.
  EdgeRuntime.waitUntil?.(backfillTranslations(rows, lang));

  return jsonResponse({
    results: rows,
    translated_query: translatedQuery,
  });
});

// Older Deno runtimes don't expose EdgeRuntime — guard so the file still
// compiles in IDEs that use the standard Deno types.
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
