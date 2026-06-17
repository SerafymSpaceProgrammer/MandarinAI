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

async function transcribe(audio: Uint8Array, mime: string): Promise<string | null> {
  // We deliberately do NOT pass the expected text in `prompt` — Whisper
  // happily echoes the prompt back when audio is ambiguous, which masks
  // wrong-tone pronunciations as correct hanzi. A neutral context line is
  // enough to bias the model toward standard Mandarin without leaking the
  // answer.
  const prompt = "普通话发音录音。";
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

type ToneAnalysis = {
  /** 0..1 — fraction of expected syllables where the heard tone matches. */
  toneAccuracy: number;
  /** Per-syllable detail for the UI. */
  perSyllable: Array<{
    hanzi: string;
    expected_tone: number; // 1..5
    heard_tone: number; // 1..5; 0 if model couldn't tell
    correct: boolean;
  }>;
  /** Short coach note, in user's language if the prompt requested it. */
  notes?: string;
};

/**
 * Tone audit pass — sends the recording to gpt-4o-mini-audio-preview and
 * asks for per-syllable tone evaluation. Returns null if the model rejects
 * the audio format (m4a isn't officially supported; the call falls back to
 * char-only scoring in that case). The call is fire-and-best-effort: a
 * failure here never blocks the scoring response.
 */
async function analyzeTones(
  audio: Uint8Array,
  mime: string,
  expectedHanzi: string,
  expectedPinyin: string,
): Promise<ToneAnalysis | null> {
  if (!expectedPinyin) return null;
  const b64 = bytesToBase64(audio);
  // Try formats most likely to be accepted; m4a often works even though
  // it isn't documented.
  const formats: Array<"m4a" | "mp3" | "wav"> = ["m4a", "mp3", "wav"];

  const systemPrompt =
    `You are a STRICT Mandarin pronunciation grader. The student is rehearsing:\n` +
    `  hanzi:  ${expectedHanzi}\n` +
    `  pinyin: ${expectedPinyin}\n` +
    `\n` +
    `Listen to the recording and judge the TONE of every expected syllable.\n` +
    `Be honest — most learners get tones wrong. Default to "correct: false"\n` +
    `unless the heard tone contour clearly matches the expected one:\n` +
    `  1 = high level (¯)        keep pitch flat and high\n` +
    `  2 = rising (´)            pitch rises from mid to high\n` +
    `  3 = low / dipping (ˇ)     pitch dips, often turns up at the end\n` +
    `  4 = falling (\`)          pitch falls sharply from high to low\n` +
    `  5 = neutral / light       short, unstressed, follows previous tone\n` +
    `\n` +
    `If the contour is ambiguous, flat where it should rise/fall, or sounds\n` +
    `like a different tone — mark "correct": false and put the tone you\n` +
    `actually heard in "heard_tone" (use 0 if unintelligible).\n` +
    `\n` +
    `Return JSON with this exact shape:\n` +
    `{\n` +
    `  "syllables": [\n` +
    `    {"hanzi": "你", "expected_tone": 3, "heard_tone": 3, "correct": true},\n` +
    `    ...one entry per expected syllable, in order, hanzi only (no punctuation)...\n` +
    `  ],\n` +
    `  "notes": "one short sentence in English describing which tones were off"\n` +
    `}`;

  for (const format of formats) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Full gpt-4o-audio-preview is noticeably more discerning on tone
          // contour than the mini variant — worth the extra cost for an
          // assessment endpoint that gates progress feedback.
          model: "gpt-4o-audio-preview",
          modalities: ["text"],
          response_format: { type: "json_object" },
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: { data: b64, format },
                },
                {
                  type: "text",
                  text:
                    "Grade the recording strictly. Mark a tone correct only if you can clearly hear the matching pitch contour for that syllable.",
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn(`tone audit ${format} failed`, res.status, txt.slice(0, 200));
        // Try next format on 400 (bad format) only.
        if (res.status === 400) continue;
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as {
        syllables?: Array<{
          hanzi: string;
          expected_tone: number;
          heard_tone: number;
          correct: boolean;
        }>;
        notes?: string;
      };
      const syllables = Array.isArray(parsed.syllables) ? parsed.syllables : [];
      if (syllables.length === 0) return null;
      const correct = syllables.filter((s) => s.correct).length;
      return {
        toneAccuracy: correct / syllables.length,
        perSyllable: syllables.map((s) => ({
          hanzi: String(s.hanzi ?? ""),
          expected_tone: Number(s.expected_tone) || 0,
          heard_tone: Number(s.heard_tone) || 0,
          correct: !!s.correct,
        })),
        notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
      };
    } catch (err) {
      console.warn(`tone audit ${format} threw`, err);
    }
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  // Encode in chunks to avoid call-stack blow-up on long audio.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

type Verdict = "excellent" | "good" | "try_again" | "unclear";

interface Score {
  transcript: string;
  score: number;
  perChar: Array<{ char: string; matched: boolean }>;
  verdict: Verdict;
  toneAnalysis?: ToneAnalysis;
}

/**
 * Blend character-level transcription accuracy with tone-level audio
 * analysis. Characters carry 40% of the score, tones the remaining 60% —
 * tones are the part that's most often wrong and that Whisper alone can't
 * catch. If tone analysis is unavailable (m4a rejected, model error), we
 * fall back to a stricter character match that requires the exact phrase
 * verbatim to award high marks.
 */
function scoreTranscription(
  transcribed: string,
  expected: string,
  tones: ToneAnalysis | null,
): Score {
  // Punctuation in `expected` (。！？，「」) is never present in the stripped
  // transcript, so matching it gives spurious "wrong" entries that drag
  // the score down for a perfectly-said phrase. Score and display ONLY the
  // hanzi positions; punctuation passes through as already-matched chips
  // so the UI doesn't paint them red.
  const HAN_RE = /[一-鿿]/;
  const rawChars = [...expected];
  const heard = transcribed.replace(/[^一-鿿]/g, "");
  const expectedHanziOnly = rawChars.filter((c) => HAN_RE.test(c)).join("");

  let cursor = 0;
  const perChar = rawChars.map((c) => {
    if (!HAN_RE.test(c)) {
      // Treat punctuation as a free pass — it's not a pronunciation target.
      return { char: c, matched: true };
    }
    const idx = heard.indexOf(c, cursor);
    const matched = idx >= 0;
    if (matched) cursor = idx + 1;
    return { char: c, matched };
  });

  const hanziPerChar = perChar.filter((p) => HAN_RE.test(p.char));
  const matched = hanziPerChar.filter((p) => p.matched).length;
  const charAcc = hanziPerChar.length > 0 ? matched / hanziPerChar.length : 0;
  // Exact match is compared against the hanzi-only canonical form so a
  // missing comma doesn't ruin a perfect read.
  const exactInOrder = heard.includes(expectedHanziOnly);

  let finalScore: number;
  if (tones) {
    // 40% characters + 60% tones. Bump to 100 only when both are perfect.
    const blended = 0.4 * charAcc + 0.6 * tones.toneAccuracy;
    finalScore = Math.round(blended * 100);
    if (exactInOrder && tones.toneAccuracy >= 0.99) finalScore = 100;
  } else {
    // Tone analysis unavailable — use a tightened char-only rubric.
    // Exact phrase: up to 90 (we cap below 100 to acknowledge we couldn't
    // verify tones); partial: pro-rate the matched fraction.
    finalScore = exactInOrder ? 90 : Math.round(charAcc * 80);
  }

  const verdict: Verdict =
    finalScore >= 85 ? "excellent" : finalScore >= 60 ? "good" : finalScore >= 30 ? "try_again" : "unclear";

  return {
    transcript: transcribed,
    score: finalScore,
    perChar,
    verdict,
    toneAnalysis: tones ?? undefined,
  };
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
  let expectedPinyin = "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      expected?: string;
      expectedPinyin?: string;
      audioBase64?: string;
      mime?: string;
    };
    if (!body.expected || !body.audioBase64) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }
    expected = body.expected;
    expectedPinyin = (body.expectedPinyin ?? "").trim();
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

  // Run the cheap+fast Whisper transcription and the tone audit in parallel
  // — they're independent OpenAI calls. If the audit fails (m4a rejected,
  // network blip), scoreTranscription falls back to a char-only rubric.
  const [transcript, tones] = await Promise.all([
    transcribe(audio, audioMime),
    analyzeTones(audio, audioMime, expected, expectedPinyin),
  ]);
  if (transcript === null) {
    return jsonResponse({ error: "transcription_failed" }, 502);
  }

  const result = scoreTranscription(transcript, expected, tones);
  return jsonResponse(result);
});
