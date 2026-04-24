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
 */
export function generatePlan(input: PlanInput): PlanItem[] {
  const {
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
      title: "Review vocabulary",
      subtitle: `${dueCount} ${dueCount === 1 ? "card" : "cards"} due`,
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
      title: "Learn new words",
      subtitle: `HSK ${profile.hsk_level} · 5 fresh words`,
      emoji: "📚",
      durationMin: 5,
      priority: 80,
      href: null, // wired up in Phase 4
      progress: 0,
    });
  }

  // ── 3. Characters — hanzi drilling.
  items.push({
    id: "character_new",
    type: "character_new",
    title: "Practice characters",
    subtitle: "Strokes + mnemonics",
    emoji: "字",
    durationMin: 5,
    priority: 60,
    href: null,
    progress: 0,
  });

  // ── 4. Grammar — keep patterns fresh.
  items.push({
    id: "grammar",
    type: "grammar",
    title: "One grammar pattern",
    subtitle: levelAppropriatePattern(profile.hsk_level),
    emoji: "📐",
    durationMin: 4,
    priority: 55,
    href: null,
    progress: 0,
  });

  // ── 5. Speaking — suggested if user hasn't done one in today.
  if (conversationsCompletedToday === 0 && budget >= 15) {
    items.push({
      id: "speaking",
      type: "speaking",
      title: "Speaking scenario",
      subtitle: "5-minute conversation",
      emoji: "🗣️",
      durationMin: 5,
      priority: 50,
      href: null,
      progress: 0,
    });
  }

  // ── 6. Listening — ambient audio works well for longer time budgets.
  if (budget >= 30) {
    items.push({
      id: "listening",
      type: "listening",
      title: "Listening snippet",
      subtitle: "Short audio + quiz",
      emoji: "🎧",
      durationMin: 5,
      priority: 40,
      href: null,
      progress: 0,
    });
  }

  // ── 7. Reading — graded story for serious learners.
  if (budget >= 30) {
    items.push({
      id: "reading",
      type: "reading",
      title: "Read a short story",
      subtitle: "Tap unknown words",
      emoji: "📖",
      durationMin: 7,
      priority: 30,
      href: null,
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

function levelAppropriatePattern(level: number): string {
  switch (level) {
    case 1:
    case 2:
      return "Basic sentence order: S + V + O";
    case 3:
      return "是…的 emphasis";
    case 4:
      return "把 construction";
    case 5:
      return "Resultative complements";
    default:
      return "Nuance: 也许 vs 可能";
  }
}
