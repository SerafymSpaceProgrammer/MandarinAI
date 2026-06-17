import { supabase } from "@/api";
import { logger } from "@/lib/logger";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type TutorError =
  | { kind: "not_authenticated" }
  | { kind: "network" }
  | { kind: "daily_limit"; used: number; limit: number }
  | { kind: "server"; message: string };

export async function sendTutorMessage(
  messages: ChatMsg[],
  hskLevel: number,
  nativeLang: string,
): Promise<{ ok: true; reply: string } | { ok: false; error: TutorError }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, error: { kind: "not_authenticated" } };

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat-tutor`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ messages, hskLevel, nativeLang }),
    });
  } catch (err) {
    logger.warn("chat-tutor fetch error", err);
    return { ok: false, error: { kind: "network" } };
  }

  if (res.status === 429) {
    const body = (await safeJson(res)) as { used?: number; limit?: number };
    return {
      ok: false,
      error: { kind: "daily_limit", used: body.used ?? 0, limit: body.limit ?? 30 },
    };
  }
  if (!res.ok) {
    const body = (await safeJson(res)) as { error?: string };
    return { ok: false, error: { kind: "server", message: body.error ?? `http_${res.status}` } };
  }

  const data = (await res.json()) as { reply?: string };
  if (!data.reply) {
    return { ok: false, error: { kind: "server", message: "empty_reply" } };
  }
  return { ok: true, reply: data.reply };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
