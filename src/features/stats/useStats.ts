import { useEffect, useState } from "react";

import { supabase } from "@/api";
import { computeStreak, fetchRecentActivity, todayISO, type DailyActivityRow } from "@/features/activity/activity";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { logger } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";

export type HskBreakdown = {
  hskLevel: number;
  total: number;
  new: number; // review_count == 0
  learning: number; // 1..4
  mastered: number; // >=5
};

export type SkillTotals = {
  vocab: number;
  characters: number;
  speaking: number;
  exercises: number;
};

export type StatsData = {
  loading: boolean;
  streak: number;
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  todaysXp: number;
  todaysMinutes: number;
  activity: DailyActivityRow[]; // last 90 days (today first)
  hsk: HskBreakdown[];
  skills30d: SkillTotals;
  insight: string;
  refresh: () => Promise<void>;
};

const XP_PER_LEVEL = 100;

function deriveLevel(xp: number): { level: number; into: number; next: number } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, next: XP_PER_LEVEL };
}

function buildInsight(
  args: {
    streak: number;
    todaysXp: number;
    totalSaved: number;
    mastered: number;
    skills: SkillTotals;
  },
  t: ReturnType<typeof useT>,
): string {
  const { streak, todaysXp, totalSaved, mastered, skills } = args;

  if (totalSaved === 0) return t.stats.insightSaveFirst;
  if (streak === 0) return t.stats.insightStartStreak;
  if (todaysXp === 0) return fmt(t.stats.insightKeepGoing, { n: streak });
  if (mastered === 0 && totalSaved > 10) return t.stats.insightNeedMastery;
  if (skills.speaking === 0 && skills.vocab > 20) return t.stats.insightTrySpeaking;
  if (skills.characters === 0 && skills.vocab > 10) return t.stats.insightTryCharacters;
  return fmt(t.stats.insightOnTrack, { mastered, learning: totalSaved - mastered });
}

export function useStats(): StatsData {
  const session = useUserStore((s) => s.session);
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<DailyActivityRow[]>([]);
  const [hsk, setHsk] = useState<HskBreakdown[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);

  async function load() {
    if (!session) return;
    const userId = session.user.id;
    setLoading(true);

    const [rows, wordsRes] = await Promise.all([
      fetchRecentActivity(userId, 90),
      supabase
        .from("saved_words")
        .select("hsk_level, review_count")
        .eq("user_id", userId),
    ]);

    if (wordsRes.error) {
      logger.warn("saved_words fetch error", wordsRes.error.message);
    }

    const words = (wordsRes.data ?? []) as Array<{ hsk_level: number; review_count: number }>;

    const byHsk = new Map<number, HskBreakdown>();
    for (let lvl = 1; lvl <= 6; lvl++) {
      byHsk.set(lvl, { hskLevel: lvl, total: 0, new: 0, learning: 0, mastered: 0 });
    }
    for (const w of words) {
      const bucket = byHsk.get(w.hsk_level) ?? byHsk.get(0);
      if (!bucket) continue;
      bucket.total += 1;
      if (w.review_count === 0) bucket.new += 1;
      else if (w.review_count < 5) bucket.learning += 1;
      else bucket.mastered += 1;
    }

    setActivity(rows);
    setHsk(Array.from(byHsk.values()));
    setTotalSaved(words.length);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const totalXp = activity.reduce((s, r) => s + r.xp_earned, 0);
  const { level, into, next } = deriveLevel(totalXp);

  const streak = computeStreak(activity);

  const today = todayISO();
  const todaysRow = activity.find((r) => r.date === today);
  const todaysXp = todaysRow?.xp_earned ?? 0;
  const todaysMinutes = todaysRow?.minutes_studied ?? 0;

  const cutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const skills30d = activity
    .filter((r) => r.date >= cutoff)
    .reduce<SkillTotals>(
      (acc, r) => ({
        vocab: acc.vocab + r.words_reviewed,
        characters: acc.characters + r.characters_learned,
        speaking: acc.speaking + r.conversations_completed,
        exercises: acc.exercises + r.exercises_completed,
      }),
      { vocab: 0, characters: 0, speaking: 0, exercises: 0 },
    );

  const mastered = hsk.reduce((s, h) => s + h.mastered, 0);
  const insight = buildInsight(
    {
      streak,
      todaysXp,
      totalSaved,
      mastered,
      skills: skills30d,
    },
    t,
  );

  return {
    loading,
    streak,
    totalXp,
    level,
    xpIntoLevel: into,
    xpForNextLevel: next,
    todaysXp,
    todaysMinutes,
    activity,
    hsk,
    skills30d,
    insight,
    refresh: load,
  };
}
