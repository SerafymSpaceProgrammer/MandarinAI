import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { supabase } from "@/api";
import { fetchRecentActivity, todayISO } from "@/features/activity/activity";
import { logger } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";

const LAST_ATTEMPT_KEY = "@mandarinai/practice/last-speaking-attempt:v1";

/**
 * Last-completed speaking-scenario attempt. Lives in AsyncStorage so the
 * Practice screen can surface a "Last attempt" hero even before the user
 * scrolls — Supabase has no persisted scoreboard yet, and we don't need
 * cross-device sync for a local "what did I just do" widget.
 */
export type LastSpeakingAttempt = {
  scenarioId: string;
  scenarioTitle: string;
  hskLevel: number;
  hanzi: string;
  pinyin: string;
  /** 0–100; mean across all scored turns. */
  score: number;
  /** Millis since epoch — used to expire stale "last attempts" if we ever want to. */
  timestamp: number;
};

export async function recordLastSpeakingAttempt(
  attempt: LastSpeakingAttempt,
): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ATTEMPT_KEY, JSON.stringify(attempt));
  } catch (err) {
    logger.warn("recordLastSpeakingAttempt failed", String(err));
  }
}

async function readLastSpeakingAttempt(): Promise<LastSpeakingAttempt | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ATTEMPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastSpeakingAttempt;
  } catch (err) {
    logger.warn("readLastSpeakingAttempt failed", String(err));
    return null;
  }
}

export type PracticeData = {
  loading: boolean;
  /** Total minutes_studied today. Surfaced as the "X / Goal today" pill. */
  minutesToday: number;
  /** User's daily goal in minutes (mirrors profile.daily_goal_minutes). */
  dailyGoalMinutes: number;
  /** conversations_completed summed across the last 7 days × 2 min/scenario.
   *  We don't track per-skill minutes, so this is a reasonable estimate. */
  speakingMinutesThisWeek: number;
  /** exercises_completed summed across the last 30 days. Stand-in for
   *  "listening exercises" until a dedicated counter lands. */
  listeningExercisesThisMonth: number;
  /** All characters the user has touched (any step > 0). */
  charactersTouched: number;
  /** Last attempted speaking scenario; null when nothing has been completed. */
  lastAttempt: LastSpeakingAttempt | null;
  refresh: () => Promise<void>;
};

export function usePracticeData(): PracticeData {
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);

  const [loading, setLoading] = useState(true);
  const [minutesToday, setMinutesToday] = useState(0);
  const [speakingMinutesThisWeek, setSpeakingMinutesThisWeek] = useState(0);
  const [listeningExercisesThisMonth, setListeningExercisesThisMonth] = useState(0);
  const [charactersTouched, setCharactersTouched] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<LastSpeakingAttempt | null>(null);

  async function load() {
    if (!session) {
      setLoading(false);
      return;
    }
    const userId = session.user.id;

    const [activityRows, charsRes, attempt] = await Promise.all([
      fetchRecentActivity(userId, 30),
      supabase
        .from("user_characters")
        .select("hanzi", { count: "exact", head: true })
        .eq("user_id", userId)
        .gt("step_completed", 0),
      readLastSpeakingAttempt(),
    ]);

    if (charsRes.error) {
      logger.warn("usePracticeData chars error", charsRes.error.message);
    }

    const today = activityRows.find((r) => r.date === todayISO());

    // Last 7 days — sum of conversations_completed × 2 min (rough estimate).
    const weekCutoff = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    })();
    const conversationsThisWeek = activityRows
      .filter((r) => r.date >= weekCutoff)
      .reduce((s, r) => s + r.conversations_completed, 0);

    // Last 30 days exercises (we already fetched 30 days).
    const exercisesThisMonth = activityRows.reduce(
      (s, r) => s + r.exercises_completed,
      0,
    );

    setMinutesToday(today?.minutes_studied ?? 0);
    setSpeakingMinutesThisWeek(conversationsThisWeek * 2);
    setListeningExercisesThisMonth(exercisesThisMonth);
    setCharactersTouched(charsRes.count ?? 0);
    setLastAttempt(attempt);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  return {
    loading,
    minutesToday,
    dailyGoalMinutes: profile?.daily_goal_minutes ?? 15,
    speakingMinutesThisWeek,
    listeningExercisesThisMonth,
    charactersTouched,
    lastAttempt,
    refresh: load,
  };
}
