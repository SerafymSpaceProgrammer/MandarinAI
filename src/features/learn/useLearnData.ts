import { useEffect, useState } from "react";

import { supabase } from "@/api";
import { fetchUserCharacters } from "@/features/character/character";
import { fetchTopics, type Topic } from "@/features/hsk/hsk";
import { logger } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";

/**
 * Aggregate counters powering the Learn → Library screen's 2×2 section grid.
 * Each card surfaces a "you've done this much" subtitle + a small progress
 * bar, so we need just a handful of cheap counts per section.
 *
 * Numbers come from three sources:
 *   • saved_words  → deck stats (Words + HSK catalog progress)
 *   • user_characters → mastered/learning counts (Characters)
 *   • profile.hsk_level + a constant → HSK catalog total
 *
 * Grammar progress isn't persisted anywhere yet, so the card just shows a
 * "NEW" badge and zero progress until that data lands.
 */

const HSK_TOTAL_WORDS = 6300;
const CHARACTER_TOTAL_HSK1 = 178; // size of HSK-1 character set we ship

export type LearnData = {
  loading: boolean;

  // Words card
  deckTotal: number;
  dueCount: number;
  masteredWords: number;

  // HSK card
  hskTotalWords: number;
  hskCovered: number; // saved words with hsk_level > 0

  // Characters card
  charactersMastered: number;
  charactersLearning: number;
  charactersTotal: number;

  // Grammar card (stub)
  grammarPatternsCompleted: number;
  grammarPatternsTotal: number;

  // Topics row (top 3 by word count)
  topTopics: Topic[];

  refresh: () => Promise<void>;
};

export function useLearnData(): LearnData {
  const session = useUserStore((s) => s.session);

  const [loading, setLoading] = useState(true);
  const [deckTotal, setDeckTotal] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [masteredWords, setMasteredWords] = useState(0);
  const [hskCovered, setHskCovered] = useState(0);
  const [charactersMastered, setCharactersMastered] = useState(0);
  const [charactersLearning, setCharactersLearning] = useState(0);
  const [topTopics, setTopTopics] = useState<Topic[]>([]);

  async function load() {
    if (!session) {
      setLoading(false);
      return;
    }
    const userId = session.user.id;

    const [dueRes, wordsRes, characters, topics] = await Promise.all([
      supabase
        .from("saved_words")
        .select("hanzi", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("next_review_at", new Date().toISOString()),
      supabase
        .from("saved_words")
        .select("hsk_level, review_count")
        .eq("user_id", userId),
      fetchUserCharacters(userId),
      fetchTopics(),
    ]);

    if (dueRes.error) logger.warn("learn due error", dueRes.error.message);
    if (wordsRes.error) logger.warn("learn words error", wordsRes.error.message);

    const words = (wordsRes.data ?? []) as Array<{
      hsk_level: number;
      review_count: number;
    }>;

    let mastered = 0;
    let coveredHsk = 0;
    for (const w of words) {
      if (w.review_count >= 5) mastered += 1;
      if (w.hsk_level > 0) coveredHsk += 1;
    }

    let charMastered = 0;
    let charLearning = 0;
    for (const c of characters) {
      if (c.step_completed >= 5) charMastered += 1;
      else if (c.step_completed > 0) charLearning += 1;
    }

    setDeckTotal(words.length);
    setDueCount(dueRes.count ?? 0);
    setMasteredWords(mastered);
    setHskCovered(coveredHsk);
    setCharactersMastered(charMastered);
    setCharactersLearning(charLearning);
    setTopTopics(topics.slice(0, 6));
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  return {
    loading,
    deckTotal,
    dueCount,
    masteredWords,
    hskTotalWords: HSK_TOTAL_WORDS,
    hskCovered,
    charactersMastered,
    charactersLearning,
    charactersTotal: CHARACTER_TOTAL_HSK1,
    grammarPatternsCompleted: 0,
    grammarPatternsTotal: 30,
    topTopics,
    refresh: load,
  };
}
