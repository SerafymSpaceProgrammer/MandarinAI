import type { SavedWord } from "./vocab";

/**
 * Intra-session drill engine — a Leitner-style mini SRS layered on top of the
 * persistent SM-2 deck. Each card cycles through the queue until the user has
 * answered it correctly `requiredCorrect` times. A wrong (or insufficiently
 * correct) answer re-inserts the card `repeatGap` positions ahead so the user
 * sees it again after seeing a handful of others — short-term reinforcement
 * without overhauling the long-term schedule.
 *
 * This is intentionally separate from `gradeCard` in vocab.ts: a drill is a
 * focused practice loop, not a replacement for SM-2. Nothing here writes to
 * saved_words; the parent screen decides whether to also call gradeCard.
 */

export type DrillItem = {
  card: SavedWord;
  /** How many times the user has answered this card correctly so far. */
  correctCount: number;
  /** Total attempts (correct + wrong). Used for accuracy stats. */
  attempts: number;
  /** True iff the last response was wrong — drives the "вернётся ещё раз"
   *  toast and the wrong-pulse animation in the session UI. */
  lastWrong: boolean;
};

export type DrillConfig = {
  /** How many positions ahead to re-queue an item that isn't done yet.
   *  Default 5 — matches the user's "повтор через несколько карточек". */
  repeatGap: number;
  /** Correct answers needed to drop a card from the queue. Default 2 —
   *  one correct answer can be a lucky guess; two is real recall. */
  requiredCorrect: number;
};

export const DRILL_DEFAULTS: DrillConfig = {
  repeatGap: 5,
  requiredCorrect: 2,
};

/**
 * Build a fresh queue from an unordered set of cards. Shuffled by default so
 * back-to-back drills on the same deck feel different.
 */
export function makeDrillQueue(
  cards: SavedWord[],
  shuffle = true,
): DrillItem[] {
  const arr = shuffle ? [...cards].sort(() => Math.random() - 0.5) : [...cards];
  return arr.map((card) => ({
    card,
    correctCount: 0,
    attempts: 0,
    lastWrong: false,
  }));
}

/**
 * Apply a user answer to the head of the queue, returning the new queue:
 *   - correct + reached `requiredCorrect` → card leaves the queue (done)
 *   - correct, not yet done → re-queued at `repeatGap` positions ahead
 *   - wrong → re-queued at `repeatGap` positions ahead (correctCount unchanged)
 */
export function answerDrill(
  queue: DrillItem[],
  correct: boolean,
  config: DrillConfig = DRILL_DEFAULTS,
): DrillItem[] {
  if (queue.length === 0) return queue;
  const [head, ...rest] = queue;
  if (!head) return rest;
  const next: DrillItem = {
    ...head,
    attempts: head.attempts + 1,
    correctCount: correct ? head.correctCount + 1 : head.correctCount,
    lastWrong: !correct,
  };
  if (next.correctCount >= config.requiredCorrect) {
    return rest;
  }
  // Re-insert at +repeatGap positions, clamped to the rest's length so we
  // never silently lose the card off the end of a short queue.
  const insertAt = Math.min(config.repeatGap, rest.length);
  return [...rest.slice(0, insertAt), next, ...rest.slice(insertAt)];
}

export type DrillStats = {
  /** Cards still in the queue (counts duplicates). */
  remaining: number;
  /** Cards completed (left the queue). */
  uniqueCompleted: number;
  /** Total unique cards the session started with. */
  totalUnique: number;
  /** Sum of attempts across all items currently in queue + already-done.
   *  Used to compute accuracy together with `correctAttempts`. */
  totalAttempts: number;
  /** Correct responses so far across all attempts. */
  correctAttempts: number;
};

/**
 * Compute live session stats from the current queue + the initial total.
 * `correctAttemptsSoFar` is tracked outside (the queue doesn't remember done
 * cards), so the parent component passes its running counter in.
 */
export function computeStats(
  queue: DrillItem[],
  initialTotal: number,
  correctAttemptsSoFar: number,
  totalAttemptsSoFar: number,
): DrillStats {
  const uniqueRemaining = new Set(queue.map((i) => i.card.hanzi)).size;
  return {
    remaining: queue.length,
    uniqueCompleted: Math.max(0, initialTotal - uniqueRemaining),
    totalUnique: initialTotal,
    totalAttempts: totalAttemptsSoFar,
    correctAttempts: correctAttemptsSoFar,
  };
}
