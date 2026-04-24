import { supabase } from "@/api";
import { logger } from "@/lib/logger";

export type ActivityDelta = {
  minutes_studied?: number;
  words_reviewed?: number;
  words_learned?: number;
  characters_learned?: number;
  conversations_completed?: number;
  exercises_completed?: number;
  xp_earned?: number;
};

export type DailyActivityRow = {
  date: string;
  minutes_studied: number;
  words_reviewed: number;
  words_learned: number;
  characters_learned: number;
  conversations_completed: number;
  exercises_completed: number;
  xp_earned: number;
};

/** YYYY-MM-DD in the user's local timezone. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Add to today's counters. Upserts the row; on conflict increments the
 * existing numeric fields. Called whenever the user completes anything that
 * should register as engagement (review, exercise, scenario, …).
 */
export async function recordActivity(
  userId: string,
  delta: ActivityDelta,
): Promise<void> {
  const today = todayISO();

  // Fetch current row (if any) then overwrite with incremented fields.
  // `upsert` + RPC would avoid the round trip, but keeping it simple for MVP.
  const { data: existing, error: readErr } = await supabase
    .from("daily_activity")
    .select("minutes_studied, words_reviewed, words_learned, characters_learned, conversations_completed, exercises_completed, xp_earned")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (readErr) {
    logger.warn("recordActivity read error", readErr.message);
    return;
  }

  const current = existing ?? {
    minutes_studied: 0,
    words_reviewed: 0,
    words_learned: 0,
    characters_learned: 0,
    conversations_completed: 0,
    exercises_completed: 0,
    xp_earned: 0,
  };

  const next = {
    user_id: userId,
    date: today,
    minutes_studied: current.minutes_studied + (delta.minutes_studied ?? 0),
    words_reviewed: current.words_reviewed + (delta.words_reviewed ?? 0),
    words_learned: current.words_learned + (delta.words_learned ?? 0),
    characters_learned: current.characters_learned + (delta.characters_learned ?? 0),
    conversations_completed: current.conversations_completed + (delta.conversations_completed ?? 0),
    exercises_completed: current.exercises_completed + (delta.exercises_completed ?? 0),
    xp_earned: current.xp_earned + (delta.xp_earned ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { error: writeErr } = await supabase
    .from("daily_activity")
    .upsert(next, { onConflict: "user_id,date" });

  if (writeErr) {
    logger.warn("recordActivity write error", writeErr.message);
  }
}

/**
 * Fetch the last `days` daily_activity rows, newest first.
 */
export async function fetchRecentActivity(
  userId: string,
  days: number,
): Promise<DailyActivityRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("daily_activity")
    .select("date, minutes_studied, words_reviewed, words_learned, characters_learned, conversations_completed, exercises_completed, xp_earned")
    .eq("user_id", userId)
    .gte("date", sinceIso)
    .order("date", { ascending: false });

  if (error) {
    logger.warn("fetchRecentActivity error", error.message);
    return [];
  }
  return (data ?? []) as DailyActivityRow[];
}

/**
 * Count consecutive days with activity ending at today (or yesterday if
 * today is empty — so the streak doesn't die at midnight).
 */
export function computeStreak(rows: DailyActivityRow[]): number {
  if (rows.length === 0) return 0;

  const activeDays = new Set(rows.map((r) => r.date));

  // Walk backwards from today until we hit an inactive day. Allow today to
  // be empty (so pre-review the streak still shows as "14", not "0").
  const cursor = new Date();
  let streak = 0;
  let allowMiss = true;

  for (let i = 0; i < 400; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (activeDays.has(key)) {
      streak += 1;
      allowMiss = false;
    } else if (allowMiss) {
      allowMiss = false;
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
