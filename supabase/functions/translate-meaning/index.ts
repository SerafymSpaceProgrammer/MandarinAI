// translate-meaning — MandarinAI edge function
//
// Returns the meaning of an HSK hanzi in the user's language. Looks up the
// hsk_word_translations cache first; if missing, asks Google Translate
// (the same unauthenticated endpoint the ChineseLens extension uses) and
// writes the result back into the cache so the next caller — for any user
// — gets it instantly. No OpenAI cost, no upfront translation of the whole
// 6321-word catalog.
//
// Deployed with --no-verify-jwt; verifies the caller manually against
// GoTrue /user (ES256 gateway gotcha per the feedback memory).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SUPPORTED_LANGS = new Set(["en", "es", "pt", "ru", "zh"]);

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

type Cached = { meanings: string[]; source: "cache" | "google" };

async function readCache(hanzi: string, lang: string): Promise<string[] | null> {
  const url =
    `${SUPABASE_URL}/rest/v1/hsk_word_translations?hanzi=eq.${encodeURIComponent(hanzi)}&lang=eq.${encodeURIComponent(lang)}&select=meanings`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ meanings: string[] }>;
  if (rows.length === 0 || !rows[0].meanings || rows[0].meanings.length === 0) return null;
  return rows[0].meanings;
}

async function writeCache(hanzi: string, lang: string, meanings: string[]): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/hsk_word_translations?on_conflict=hanzi,lang`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([
        { hanzi, lang, meanings, source: "auto" },
      ]),
    },
  ).catch(() => undefined);
}

/**
 * Free Google Translate endpoint, same as the extension uses. Returns the
 * romanized meaning translated into `lang`. We split the result on common
 * separators so the UI can show e.g. ["to love", "love"] for 爱.
 */
async function googleTranslate(hanzi: string, lang: string): Promise<string[] | null> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(hanzi)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as unknown[];
    const segments = (data[0] as Array<[string, string]>) ?? [];
    const joined = segments
      .map((s) => (Array.isArray(s) ? String(s[0] ?? "") : ""))
      .join("")
      .trim();
    if (!joined) return null;
    // Split on common multi-meaning separators.
    return joined
      .split(/[;／/]|,\s/g)
      .map((m) => m.trim())
      .filter((m) => m.length > 0)
      .slice(0, 5);
  } catch {
    return null;
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

  const body = await req.json().catch(() => null) as
    | { hanzi?: string; lang?: string; hanzis?: string[] }
    | null;

  if (!body) return jsonResponse({ error: "invalid_payload" }, 400);

  const lang = (body.lang ?? "en").toLowerCase();
  if (!SUPPORTED_LANGS.has(lang)) {
    return jsonResponse({ error: "unsupported_lang", lang }, 400);
  }

  // Batch mode: caller passed hanzis: string[]
  if (Array.isArray(body.hanzis)) {
    const hanzis = body.hanzis.slice(0, 50); // cap per call
    const out: Record<string, Cached> = {};
    for (const h of hanzis) {
      const cached = await readCache(h, lang);
      if (cached) {
        out[h] = { meanings: cached, source: "cache" };
        continue;
      }
      const fetched = await googleTranslate(h, lang);
      if (fetched) {
        await writeCache(h, lang, fetched);
        out[h] = { meanings: fetched, source: "google" };
      } else {
        out[h] = { meanings: [], source: "google" };
      }
    }
    return jsonResponse({ results: out });
  }

  // Single mode
  if (!body.hanzi) return jsonResponse({ error: "missing_hanzi" }, 400);
  const hanzi = body.hanzi;

  const cached = await readCache(hanzi, lang);
  if (cached) {
    return jsonResponse({ hanzi, lang, meanings: cached, source: "cache" });
  }

  const fetched = await googleTranslate(hanzi, lang);
  if (!fetched) {
    return jsonResponse({ error: "translation_failed", hanzi, lang }, 502);
  }
  await writeCache(hanzi, lang, fetched);
  return jsonResponse({ hanzi, lang, meanings: fetched, source: "google" });
});
