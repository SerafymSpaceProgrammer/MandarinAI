// dict-examples — MandarinAI edge function
//
// Given a list of hanzi, returns one short example sentence per word. Used
// by the word-order and fill-blank exercises when the user's pool comes
// from HSK / dictionary (where `context_sentence` is absent).
//
// Pipeline:
//   1. Look up `dictionary_examples` cache for each hanzi.
//   2. For misses, batch-call OpenAI gpt-4o-mini with a single completion
//      that returns a JSON map of {hanzi: sentence}. Cost ~ $0.001 per
//      batch of 10.
//   3. Upsert misses into the cache so future calls hit it directly.
//
// Deployed with --no-verify-jwt; manual JWT verification on /auth/v1/user.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;

const MAX_HANZI = 20; // cap per call to keep latency + cost predictable

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
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string };
  return { userId: u.id };
}

async function readCache(hanzis: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (hanzis.length === 0) return out;
  const inList = hanzis.map((h) => `"${h.replace(/"/g, '\\"')}"`).join(",");
  const url = `${SUPABASE_URL}/rest/v1/dictionary_examples?hanzi=in.(${encodeURIComponent(inList)})&select=hanzi,sentence`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return out;
  const rows = (await res.json()) as Array<{ hanzi: string; sentence: string }>;
  for (const r of rows) out[r.hanzi] = r.sentence;
  return out;
}

async function writeCache(map: Record<string, string>): Promise<void> {
  const rows = Object.entries(map).map(([hanzi, sentence]) => ({
    hanzi,
    sentence,
    source: "ai" as const,
  }));
  if (rows.length === 0) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/dictionary_examples?on_conflict=hanzi`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  ).catch(() => undefined);
}

/**
 * Batch GPT call — one completion that returns a JSON map for the whole
 * list. JSON-mode keeps the response shape predictable; the system prompt
 * pins the length range (8–14 hanzi) and forces every output sentence to
 * actually contain the input word as a verbatim substring.
 */
async function generate(hanzis: string[]): Promise<Record<string, string>> {
  const system =
    `You generate short example sentences in Mandarin Chinese for vocabulary practice. ` +
    `For each input word, write ONE simple sentence that:\n` +
    `  - is 8 to 14 hanzi long,\n` +
    `  - uses the input word verbatim (the exact characters must appear),\n` +
    `  - uses only HSK 1-4 vocabulary outside the input word,\n` +
    `  - reads naturally and makes sense.\n` +
    `Return JSON with this exact shape: { "<word1>": "<sentence1>", "<word2>": "<sentence2>", ... }.\n` +
    `Do not include pinyin, translations, or any other keys.`;
  const user = `Words: ${JSON.stringify(hanzis)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("OpenAI dict-examples error", res.status, await res.text());
      return {};
    }
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const h of hanzis) {
      const v = parsed[h];
      if (typeof v === "string" && v.includes(h) && v.length >= 4 && v.length <= 80) {
        out[h] = v;
      }
    }
    return out;
  } catch (err) {
    console.error("dict-examples fetch failed", err);
    return {};
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
    | { hanzi?: string[] }
    | null;
  if (!body || !Array.isArray(body.hanzi)) {
    return jsonResponse({ error: "missing_hanzi" }, 400);
  }

  const seen = new Set<string>();
  const inputs: string[] = [];
  for (const h of body.hanzi) {
    if (typeof h !== "string") continue;
    const trimmed = h.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    inputs.push(trimmed);
    if (inputs.length >= MAX_HANZI) break;
  }
  if (inputs.length === 0) return jsonResponse({ results: {} });

  const cached = await readCache(inputs);
  const missing = inputs.filter((h) => !cached[h]);

  let generated: Record<string, string> = {};
  if (missing.length > 0) {
    generated = await generate(missing);
    if (Object.keys(generated).length > 0) {
      await writeCache(generated);
    }
  }

  return jsonResponse({ results: { ...cached, ...generated } });
});
