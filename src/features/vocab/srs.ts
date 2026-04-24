/**
 * SM-2 spaced repetition — ported verbatim from the ChineseLens extension
 * (src/shared/srs.ts) so a review completed on either platform produces the
 * same next_review_at on the shared `saved_words` row.
 *
 * Three grades: again / good / easy. The extension has no separate "hard"
 * grade; keeping parity matters more than matching FSRS's 4-button UX.
 */

export type ReviewGrade = "again" | "good" | "easy";

export type ReviewableCard = {
  srs_interval: number;
  ease_factor: number;
  review_count: number;
};

export type ScheduledFields = {
  srs_interval: number;
  ease_factor: number;
  review_count: number;
  next_review_at: string; // ISO
};

export function scheduleNextReview(card: ReviewableCard, grade: ReviewGrade): ScheduledFields {
  let interval = card.srs_interval;
  let ease = Math.max(1.3, card.ease_factor ?? 2.5);
  const reps = card.review_count ?? 0;

  if (grade === "again") {
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (grade === "good") {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
    ease = ease + 0.1;
  } else {
    // easy
    interval = reps === 0 ? 3 : Math.round(interval * ease * 1.3);
    ease = ease + 0.15;
  }

  const next = new Date(Date.now() + interval * 86_400_000).toISOString();

  return {
    srs_interval: interval,
    ease_factor: ease,
    review_count: reps + 1,
    next_review_at: next,
  };
}

/**
 * Preview the next interval (in days) for every grade — used to label the
 * review buttons ("Good · 3d") so the user sees the cost of each choice.
 */
export function previewIntervals(card: ReviewableCard): Record<ReviewGrade, number> {
  return {
    again: scheduleNextReview(card, "again").srs_interval,
    good: scheduleNextReview(card, "good").srs_interval,
    easy: scheduleNextReview(card, "easy").srs_interval,
  };
}
