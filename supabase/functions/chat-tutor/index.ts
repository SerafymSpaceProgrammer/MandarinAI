// chat-tutor — MandarinAI edge function
//
// POST a short chat history → OpenAI replies as a casual Mandarin tutor at
// the user's HSK level, in their native language (with Chinese examples).
// Non-streaming JSON response so the RN client stays simple.
//
// Deployed with --no-verify-jwt; verifies the caller manually against
// GoTrue /user (ES256 gateway gotcha per the feedback memory).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const FREE_DAILY_LIMIT = 30;
const FN_NAME = "chat-tutor";
const MODEL = "gpt-4o-mini";
const MAX_HISTORY = 20;

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

async function checkAndIncrementQuota(
  userId: string,
): Promise<{ ok: boolean; used: number; limit: number }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_usage`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_function_name: FN_NAME,
        p_free_limit: FREE_DAILY_LIMIT,
      }),
    });
    if (!res.ok) {
      console.warn("quota RPC failed", res.status);
      return { ok: true, used: 0, limit: FREE_DAILY_LIMIT };
    }
    const data = (await res.json()) as { ok?: boolean; used?: number; limit?: number };
    return {
      ok: data.ok ?? true,
      used: data.used ?? 0,
      limit: data.limit ?? FREE_DAILY_LIMIT,
    };
  } catch {
    return { ok: true, used: 0, limit: FREE_DAILY_LIMIT };
  }
}

type ChatMsg = { role: "user" | "assistant"; content: string };

interface Payload {
  messages: ChatMsg[];
  hskLevel?: number;
  nativeLang?: string;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
  pt: "Portuguese",
  uk: "Ukrainian",
  de: "German",
  pl: "Polish",
  zh: "Simplified Chinese",
};

function buildSystemPrompt(hskLevel: number, nativeLang: string): string {
  const level = Math.max(1, Math.min(6, hskLevel));
  const langName = LANG_NAMES[nativeLang] ?? "English";
  return [
    `You are a friendly, encouraging Mandarin Chinese tutor chatting casually with a learner whose Mandarin is at HSK ${level} level.`,
    `Reply primarily in ${langName} so the learner understands, but include short Chinese examples (with pinyin in parentheses) wherever they help. Keep examples within HSK ${level} vocabulary; if you must use a higher-level word, gloss it.`,
    "Keep replies short — 2 to 5 sentences. Ask one follow-up question to keep the conversation going.",
    "If the learner writes in Chinese, gently correct mistakes by quoting the original, then giving the natural form with pinyin and a brief gloss.",
    "Never lecture. Match the learner's energy — playful if they're playful, focused if they're studying.",
  ].join(" ");
}

async function chatCompletion(
  systemPrompt: string,
  history: ChatMsg[],
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 350,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("openai non-2xx", res.status, text.slice(0, 300));
      return { ok: false, error: `openai_${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return { ok: false, error: "empty_completion" };
    return { ok: true, reply };
  } catch (err) {
    console.warn("openai fetch error", err);
    return { ok: false, error: "network" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await verifyJwt(req);
  if (!auth) return jsonResponse({ error: "unauthorized" }, 401);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return jsonResponse({ error: "messages_required" }, 400);
  }

  const history = payload.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return jsonResponse({ error: "last_message_must_be_user" }, 400);
  }

  const quota = await checkAndIncrementQuota(auth.userId);
  if (!quota.ok) {
    return jsonResponse(
      { error: "daily_limit", used: quota.used, limit: quota.limit },
      429,
    );
  }

  const systemPrompt = buildSystemPrompt(
    payload.hskLevel ?? 2,
    payload.nativeLang ?? "en",
  );
  const result = await chatCompletion(systemPrompt, history);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, 502);
  }

  return jsonResponse({ reply: result.reply, used: quota.used, limit: quota.limit });
});
