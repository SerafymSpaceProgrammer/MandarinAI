import { useEffect, useState } from "react";

import { supabase } from "@/api";
import { computeStreak, fetchRecentActivity, todayISO } from "@/features/activity/activity";
import { generatePlan, type PlanItem } from "@/features/dailyPlan/generatePlan";
import { logger } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";

export type RecentWord = {
  hanzi: string;
  pinyin: string;
  english: string;
  hsk_level: number;
  saved_at: string;
};

export type HomeData = {
  loading: boolean;
  streak: number;
  plan: PlanItem[];
  dueCount: number;
  savedWordsTotal: number;
  recentWords: RecentWord[];
  minutesStudiedToday: number;
  refresh: () => Promise<void>;
};

export function useHomeData(): HomeData {
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [savedWordsTotal, setSavedWordsTotal] = useState(0);
  const [recentWords, setRecentWords] = useState<RecentWord[]>([]);
  const [minutesStudiedToday, setMinutesStudiedToday] = useState(0);

  async function load() {
    if (!session || !profile) {
      setLoading(false);
      return;
    }
    const userId = session.user.id;

    const [
      dueRes,
      totalRes,
      recentRes,
      activityRows,
    ] = await Promise.all([
      supabase
        .from("saved_words")
        .select("hanzi", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("next_review_at", new Date().toISOString()),
      supabase
        .from("saved_words")
        .select("hanzi", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("saved_words")
        .select("hanzi, pinyin, english, hsk_level, saved_at")
        .eq("user_id", userId)
        .order("saved_at", { ascending: false })
        .limit(5),
      fetchRecentActivity(userId, 90),
    ]);

    if (dueRes.error) logger.warn("due count error", dueRes.error.message);
    if (totalRes.error) logger.warn("total count error", totalRes.error.message);
    if (recentRes.error) logger.warn("recent words error", recentRes.error.message);

    const due = dueRes.count ?? 0;
    const total = totalRes.count ?? 0;
    const recent = (recentRes.data ?? []) as RecentWord[];
    const today = activityRows.find((r) => r.date === todayISO());

    const nextPlan = generatePlan({
      profile,
      dueCount: due,
      savedWordsTotal: total,
      wordsReviewedToday: today?.words_reviewed ?? 0,
      exercisesCompletedToday: today?.exercises_completed ?? 0,
      conversationsCompletedToday: today?.conversations_completed ?? 0,
      minutesStudiedToday: today?.minutes_studied ?? 0,
    });

    setDueCount(due);
    setSavedWordsTotal(total);
    setRecentWords(recent);
    setStreak(computeStreak(activityRows));
    setMinutesStudiedToday(today?.minutes_studied ?? 0);
    setPlan(nextPlan);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, profile?.hsk_level, profile?.daily_goal_minutes]);

  return {
    loading,
    streak,
    plan,
    dueCount,
    savedWordsTotal,
    recentWords,
    minutesStudiedToday,
    refresh: load,
  };
}
