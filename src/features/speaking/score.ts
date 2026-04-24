import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/api";
import { logger } from "@/lib/logger";

export type PronunciationResult = {
  transcript: string;
  score: number;
  perChar: Array<{ char: string; matched: boolean }>;
  verdict: "excellent" | "good" | "try_again" | "unclear";
};

export type ScoreError =
  | { kind: "not_authenticated" }
  | { kind: "audio_missing" }
  | { kind: "audio_too_short" }
  | { kind: "daily_limit"; used: number; limit: number }
  | { kind: "network" }
  | { kind: "server"; message: string };

/**
 * Read the local recording, base64-encode it, and POST to the
 * score-pronunciation edge function. Returns either a scored result or a
 * typed error (never throws — callers show the error inline).
 */
export async function scorePronunciation(
  audioUri: string,
  mimeType: string,
  expected: string,
): Promise<{ ok: true; result: PronunciationResult } | { ok: false; error: ScoreError }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, error: { kind: "not_authenticated" } };

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: "base64",
    });
  } catch (err) {
    logger.warn("readAsStringAsync error", err);
    return { ok: false, error: { kind: "audio_missing" } };
  }

  if (base64.length < 4_000) {
    return { ok: false, error: { kind: "audio_too_short" } };
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/score-pronunciation`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({
        expected,
        audioBase64: base64,
        mime: mimeType,
      }),
    });
  } catch (err) {
    logger.warn("score-pronunciation fetch error", err);
    return { ok: false, error: { kind: "network" } };
  }

  if (res.status === 429) {
    const body = (await safeJson(res)) as { used?: number; limit?: number };
    return {
      ok: false,
      error: { kind: "daily_limit", used: body.used ?? 0, limit: body.limit ?? 20 },
    };
  }
  if (!res.ok) {
    const body = (await safeJson(res)) as { error?: string };
    return { ok: false, error: { kind: "server", message: body.error ?? `http_${res.status}` } };
  }

  const data = (await res.json()) as PronunciationResult;
  return { ok: true, result: data };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
