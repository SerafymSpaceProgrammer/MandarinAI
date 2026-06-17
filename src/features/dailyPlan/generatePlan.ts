import { fmt, type Translations } from "@/i18n/strings";
import type { Profile } from "@/types";

export type PlanItemType =
  | "vocab_review"
  | "new_vocab"
  | "character_new"
  | "speaking"
  | "grammar"
  | "listening"
  | "reading";

export type PlanItem = {
  id: string;
  type: PlanItemType;
  title: string;
  subtitle: string;
  emoji: string;
  durationMin: number;
  /** Higher = more important. Used only for ordering. */
  priority: number;
  /** Where to route when tapped. Null = not yet wired up. */
  href: string | null;
  /** Fraction 0–1 of this item that's already done today. */
  progress: number;
};

export type PlanInput = {
  t: Translations;
  profile: Profile;
  dueCount: number;
  savedWordsTotal: number;
  wordsReviewedToday: number;
  exercisesCompletedToday: number;
  conversationsCompletedToday: number;
  minutesStudiedToday: number;
};

/**
 * Rule-based plan. AI-driven personalization is a later phase.
 *
 * The generator tries to respect the user's `daily_goal_minutes` budget —
 * items are appended in priority order until the budget is roughly filled.
 * Due reviews always lead; they're the one thing that decays if skipped.
 *
 * All user-facing strings come from the i18n dictionary so the home screen
 * renders in the user's chosen language (en/es/pt/de/pl/ru/uk/zh).
 */
export function generatePlan(input: PlanInput): PlanItem[] {
  const {
    t,
    profile,
    dueCount,
    savedWordsTotal,
    wordsReviewedToday,
    exercisesCompletedToday,
    conversationsCompletedToday,
  } = input;

  const items: PlanItem[] = [];
  const budget = profile.daily_goal_minutes;

  // ── 1. Due SRS reviews — always first if any are due.
  if (dueCount > 0) {
    const target = Math.min(dueCount, Math.max(10, Math.ceil(budget / 2)));
    items.push({
      id: "vocab_review",
      type: "vocab_review",
      title: t.home.planVocabReviewTitle,
      subtitle: fmt(
        dueCount === 1 ? t.home.planVocabReviewSubtitleOne : t.home.planVocabReviewSubtitle,
        { n: dueCount },
      ),
      emoji: "🃏",
      durationMin: Math.min(Math.max(5, Math.ceil(target / 4)), 20),
      priority: 100,
      href: "/vocab/review",
      progress: Math.min(1, wordsReviewedToday / Math.max(1, target)),
    });
  }

  // ── 2. New vocabulary — only if deck is skinny or user hasn't reviewed yet.
  const suggestNewVocab = savedWordsTotal < 50 || (dueCount === 0 && wordsReviewedToday < 10);
  if (suggestNewVocab) {
    items.push({
      id: "new_vocab",
      type: "new_vocab",
      title: t.home.planNewVocabTitle,
      subtitle: fmt(t.home.planNewVocabSubtitle, { hsk: profile.hsk_level }),
      emoji: "📚",
      durationMin: 5,
      priority: 80,
      // Land on the HSK catalog filtered to the user's current level — the
      // most natural place to discover new words.
      href: "/(app)/hsk",
      progress: 0,
    });
  }

  // ── 3. Characters — hanzi drilling.
  items.push({
    id: "character_new",
    type: "character_new",
    title: t.home.planCharacterTitle,
    subtitle: t.home.planCharacterSubtitle,
    emoji: "字",
    durationMin: 5,
    priority: 60,
    href: "/(app)/character",
    progress: 0,
  });

  // ── 4. Grammar — drill one construction. Routes to the Pattern Sprints
  //    index, where the user picks an HSK construction and runs through
  //    ~25 example phrases on a timer. The subtitle calls out a level-
  //    appropriate suggested pattern so the user knows roughly what's in
  //    store before tapping.
  items.push({
    id: "grammar",
    type: "grammar",
    title: t.home.planGrammarTitle,
    subtitle: levelAppropriatePattern(profile.hsk_level, t),
    emoji: "📐",
    durationMin: 4,
    priority: 55,
    href: "/(app)/grammar",
    progress: 0,
  });

  // ── 5. Speaking — suggested if user hasn't done one in today.
  if (conversationsCompletedToday === 0 && budget >= 15) {
    items.push({
      id: "speaking",
      type: "speaking",
      title: t.home.planSpeakingTitle,
      subtitle: t.home.planSpeakingSubtitle,
      emoji: "🗣️",
      durationMin: 5,
      priority: 50,
      href: "/(app)/practice/scenarios",
      progress: 0,
    });
  }

  // ── 6. Listening — ambient audio works well for longer time budgets.
  if (budget >= 30) {
    items.push({
      id: "listening",
      type: "listening",
      title: t.home.planListeningTitle,
      subtitle: t.home.planListeningSubtitle,
      emoji: "🎧",
      durationMin: 5,
      priority: 40,
      href: "/(app)/practice/listening",
      progress: 0,
    });
  }

  // ── 7. Reading — graded story for serious learners.
  if (budget >= 30) {
    items.push({
      id: "reading",
      type: "reading",
      title: t.home.planReadingTitle,
      subtitle: t.home.planReadingSubtitle,
      emoji: "📖",
      durationMin: 7,
      priority: 30,
      href: "/(app)/reading",
      progress: 0,
    });
  }

  // Sort by priority and trim to the time budget.
  items.sort((a, b) => b.priority - a.priority);

  const trimmed: PlanItem[] = [];
  let minutes = 0;
  for (const item of items) {
    if (minutes >= budget && trimmed.length >= 3) break;
    trimmed.push(item);
    minutes += item.durationMin;
    if (trimmed.length >= 6) break;
  }
  // Always include exercises_completed context too, even if generic.
  void exercisesCompletedToday;
  return trimmed;
}

function levelAppropriatePattern(level: number, t: Translations): string {
  switch (level) {
    case 1:
    case 2:
      return t.home.planGrammarBasic;
    case 3:
      return t.home.planGrammarShi;
    case 4:
      return t.home.planGrammarBa;
    case 5:
      return t.home.planGrammarResultative;
    default:
      return t.home.planGrammarNuance;
  }
}
