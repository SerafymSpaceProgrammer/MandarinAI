// score-pronunciation — MandarinAI edge function
//
// POST expected text + recorded audio → Whisper transcription + character-level
// accuracy score. Unlike the extension's pronunciation function this does NOT
// gate on Pro tier; instead it uses a flat daily quota shared with the existing
// check_and_increment_usage RPC so free users can rehearse scenarios.
//
// Deployed with --no-verify-jwt (ES256 gateway gotcha); verifies the caller
// manually against GoTrue /user.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const FREE_DAILY_LIMIT = 20;
const FN_NAME = "score-pronunciation";

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

async function verifyJwt(req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id: string; email: string };
  return { userId: user.id, email: user.email };
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
      // Fail open so transient DB issues don't block testing.
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

async function transcribe(audio: Uint8Array, mime: string, expected: string): Promise<string | null> {
  const prompt = `用普通话清晰地说出：${expected}`;
  // Try the newer model first, fall back to whisper-1 if it rejects the container.
  for (const model of ["gpt-4o-mini-transcribe", "whisper-1"]) {
    const form = new FormData();
    form.append("file", new Blob([audio], { type: mime }), `audio.${mime.split("/")[1] ?? "m4a"}`);
    form.append("model", model);
    form.append("language", "zh");
    form.append("response_format", "json");
    form.append("temperature", "0");
    form.append("prompt", prompt);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (res.ok) {
      const json = (await res.json()) as { text?: string };
      return (json.text ?? "").trim();
    }
    const errText = await res.text();
    console.warn(`transcription model ${model} failed`, res.status, errText);
    if (res.status >= 500) return null;
  }
  return null;
}

type Verdict = "excellent" | "good" | "try_again" | "unclear";

interface Score {
  transcript: string;
  score: number;
  perChar: Array<{ char: string; matched: boolean }>;
  verdict: Verdict;
}

function scoreTranscription(transcribed: string, expected: string): Score {
  const expectedChars = [...expected];
  const heard = transcribed.replace(/[^一-鿿]/g, "");
  const heardSet = new Set(heard);

  const perChar = expectedChars.map((c) => ({ char: c, matched: heardSet.has(c) }));
  const matched = perChar.filter((p) => p.matched).length;
  const base = expectedChars.length > 0 ? Math.round((matched / expectedChars.length) * 100) : 0;
  const exactInOrder = heard.includes(expected);
  const score = exactInOrder ? Math.max(base, 100) : base;

  const verdict: Verdict =
    score >= 90 ? "excellent" : score >= 60 ? "good" : score >= 30 ? "try_again" : "unclear";

  return { transcript: transcribed, score, perChar, verdict };
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

  const quota = await checkAndIncrementQuota(user.userId);
  if (!quota.ok) {
    return jsonResponse({ error: "daily_limit", used: quota.used, limit: quota.limit }, 429);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const contentType = req.headers.get("content-type") ?? "";
  let audio: Uint8Array;
  let audioMime = "audio/m4a";
  let expected: string;

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as { expected?: string; audioBase64?: string; mime?: string };
    if (!body.expected || !body.audioBase64) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }
    expected = body.expected;
    audioMime = body.mime ?? "audio/m4a";
    try {
      const bin = atob(body.audioBase64);
      audio = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) audio[i] = bin.charCodeAt(i);
    } catch {
      return jsonResponse({ error: "invalid_audio" }, 400);
    }
  } else {
    return jsonResponse({ error: "expected_json" }, 400);
  }

  if (audio.byteLength < 3000) {
    return jsonResponse({ error: "audio_too_short" }, 400);
  }

  const transcript = await transcribe(audio, audioMime, expected);
  if (transcript === null) {
    return jsonResponse({ error: "transcription_failed" }, 502);
  }

  const result = scoreTranscription(transcript, expected);
  return jsonResponse(result);
});
