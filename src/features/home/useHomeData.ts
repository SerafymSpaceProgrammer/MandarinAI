import { useEffect, useState } from "react";

import { supabase } from "@/api";
import { computeStreak, fetchRecentActivity, todayISO } from "@/features/activity/activity";
import { generatePlan, type PlanItem } from "@/features/dailyPlan/generatePlan";
import { fetchTranslations } from "@/features/hsk/hsk";
import { useT } from "@/i18n/i18n";
import { logger } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";
import { currentGreeting, updateWidgetData } from "@/widgets/widgetData";

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
  /** Cumulative XP across all daily_activity rows fetched (≤ 90 days). */
  totalXp: number;
  /** Derived 1-based level. Matches the formula used on the stats screen. */
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  refresh: () => Promise<void>;
};

const XP_PER_LEVEL = 100;

export function useHomeData(): HomeData {
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [savedWordsTotal, setSavedWordsTotal] = useState(0);
  const [recentWords, setRecentWords] = useState<RecentWord[]>([]);
  const [minutesStudiedToday, setMinutesStudiedToday] = useState(0);
  const [totalXp, setTotalXp] = useState(0);

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
    const recentRaw = (recentRes.data ?? []) as RecentWord[];
    const today = activityRows.find((r) => r.date === todayISO());

    // Re-translate the meaning to whatever native language the user is set
    // to right now. saved_words.english is a snapshot of whatever was
    // localized at save time; the user can have changed languages since.
    const lang = profile.native_language ?? "en";
    const translations =
      recentRaw.length > 0
        ? await fetchTranslations(
            recentRaw.map((w) => w.hanzi),
            lang,
          )
        : {};
    const recent: RecentWord[] = recentRaw.map((w) => {
      const translated = translations[w.hanzi]?.[0];
      return translated ? { ...w, english: translated } : w;
    });

    const nextPlan = generatePlan({
      t,
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
    const streakDays = computeStreak(activityRows);
    setStreak(streakDays);
    setMinutesStudiedToday(today?.minutes_studied ?? 0);
    setTotalXp(activityRows.reduce((s, r) => s + r.xp_earned, 0));
    setPlan(nextPlan);
    setLoading(false);

    // Push the freshly computed snapshot into the Android home-screen
    // widget. The widget cannot fetch from Supabase itself — it reads
    // whatever the foreground app last wrote to AsyncStorage.
    const firstWord = recent[0];
    void updateWidgetData({
      streak: streakDays,
      dueCount: due,
      wordHanzi: firstWord?.hanzi ?? null,
      wordPinyin: firstWord?.pinyin ?? null,
      wordMeaning: firstWord?.english ?? null,
      greeting: currentGreeting(),
    });
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session?.user.id,
    profile?.hsk_level,
    profile?.daily_goal_minutes,
    profile?.native_language,
  ]);

  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;

  return {
    loading,
    streak,
    plan,
    dueCount,
    savedWordsTotal,
    recentWords,
    minutesStudiedToday,
    totalXp,
    level,
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
    refresh: load,
  };
}
