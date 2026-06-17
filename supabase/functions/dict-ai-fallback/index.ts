// dict-ai-fallback — MandarinAI edge function
//
// Called by the client when `search_dictionary` returns 0 rows. Uses GPT to
// produce a single best-guess dictionary entry for whatever the user typed.
// Works for:
//   • Names / slang / neologisms missing from CC-CEDICT ("绝绝子", "网红")
//   • Loanwords ("hashtag", "VPN")
//   • User-language queries that have no direct lexical mapping
//
// The shape of the response mirrors `DictRow` from dict-search so the
// client can render it as just another result card — UX-wise the user
// can't tell whether the row came from CEDICT or from GPT.
//
// Deployed with --no-verify-jwt; verifies the caller manually against
// GoTrue /user.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;

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

const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Mandarin Chinese",
  uk: "Ukrainian",
  de: "German",
  pl: "Polish",
};

type AiEntry = {
  hanzi: string;
  pinyin: string;
  meanings: string[];
  meanings_en: string[];
};

async function askOpenAI(q: string, lang: string): Promise<AiEntry | null> {
  const langName = LANG_NAME[lang] ?? "English";
  const systemPrompt =
    `You are a Chinese-Mandarin dictionary assistant. The user gives you any string ` +
    `(could be hanzi, pinyin, English, ${langName}, or transliteration). ` +
    `Return JSON with these exact keys:\n` +
    `  hanzi:        the simplified Chinese form (string)\n` +
    `  pinyin:       tone-marked pinyin with spaces (e.g. "wǎng hóng")\n` +
    `  meanings:     1-4 short definitions in ${langName} (array of strings)\n` +
    `  meanings_en:  1-4 short definitions in English (array of strings)\n` +
    `If you cannot identify a real Mandarin word, return {"hanzi": "", "pinyin": "", "meanings": [], "meanings_en": []}.\n` +
    `Do not invent characters. Names, slang and loanwords are allowed if they have an established hanzi form.`;

  const userPrompt = `Query: ${JSON.stringify(q)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error("OpenAI error", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<AiEntry>;
    if (!parsed.hanzi || !parsed.pinyin) return null;
    return {
      hanzi: parsed.hanzi,
      pinyin: parsed.pinyin,
      meanings: Array.isArray(parsed.meanings) ? parsed.meanings.slice(0, 4) : [],
      meanings_en: Array.isArray(parsed.meanings_en) ? parsed.meanings_en.slice(0, 4) : [],
    };
  } catch (err) {
    console.error("OpenAI fetch failed", err);
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

  const body = (await req.json().catch(() => null)) as
    | { q?: string; lang?: string }
    | null;
  if (!body || typeof body.q !== "string") {
    return jsonResponse({ error: "missing_query" }, 400);
  }

  const lang = (body.lang ?? "en").toLowerCase();
  if (!SUPPORTED_LANGS.has(lang)) {
    return jsonResponse({ error: "unsupported_lang", lang }, 400);
  }

  const q = body.q.trim();
  if (q.length === 0) return jsonResponse({ result: null });

  const ai = await askOpenAI(q, lang);
  if (!ai) return jsonResponse({ result: null });

  return jsonResponse({
    result: {
      hanzi: ai.hanzi,
      pinyin: ai.pinyin,
      meanings: ai.meanings.length > 0 ? ai.meanings : ai.meanings_en,
      meanings_en: ai.meanings_en,
      hsk_level: null,
      freq: null,
      score: 100,
      source_lang: ai.meanings.length > 0 ? lang : "en",
      source: "ai" as const,
    },
  });
});
