import { supabase } from "@/api";
import { logger } from "@/lib/logger";

import { scheduleNextReview, type ReviewGrade, type ReviewableCard } from "./srs";

/**
 * Shape of `saved_words` the mobile app reads/writes. Matches the extension's
 * schema — (user_id, hanzi) is the primary key.
 */
export type SavedWord = {
  user_id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  hsk_level: number;
  saved_at: string;
  review_count: number;
  srs_interval: number;
  ease_factor: number;
  next_review_at: string;
  context_sentence: string | null;
  updated_at: string;
};

const WORD_COLUMNS =
  "user_id, hanzi, pinyin, english, hsk_level, saved_at, review_count, srs_interval, ease_factor, next_review_at, context_sentence, updated_at";

/**
 * Fetch up to `limit` cards whose next_review_at is now or earlier, ordered
 * by how overdue they are (oldest first).
 */
export async function fetchDueCards(userId: string, limit = 20): Promise<SavedWord[]> {
  const { data, error } = await supabase
    .from("saved_words")
    .select(WORD_COLUMNS)
    .eq("user_id", userId)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.warn("fetchDueCards error", error.message);
    return [];
  }
  return (data ?? []) as SavedWord[];
}

/**
 * All saved words for the user (for the browse deck screen). Newest first.
 */
export async function fetchAllWords(userId: string): Promise<SavedWord[]> {
  const { data, error } = await supabase
    .from("saved_words")
    .select(WORD_COLUMNS)
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  if (error) {
    logger.warn("fetchAllWords error", error.message);
    return [];
  }
  return (data ?? []) as SavedWord[];
}

/**
 * Count of cards due now. Kept separate so the home screen doesn't have to
 * pull the full deck.
 */
export async function dueCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("saved_words")
    .select("hanzi", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("next_review_at", new Date().toISOString());
  if (error) {
    logger.warn("dueCount error", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Count of due cards tomorrow (for the session summary screen).
 */
export async function dueCountOnDay(userId: string, day: Date): Promise<number> {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const { count, error } = await supabase
    .from("saved_words")
    .select("hanzi", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("next_review_at", start.toISOString())
    .lte("next_review_at", end.toISOString());

  if (error) {
    logger.warn("dueCountOnDay error", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Apply a grade to a card: computes the next schedule via SM-2 and persists.
 * Returns the newly scheduled fields on success, null on failure.
 */
export async function gradeCard(
  userId: string,
  hanzi: string,
  card: ReviewableCard,
  grade: ReviewGrade,
): Promise<{ srs_interval: number; ease_factor: number; next_review_at: string } | null> {
  const next = scheduleNextReview(card, grade);

  const { error } = await supabase
    .from("saved_words")
    .update({
      srs_interval: next.srs_interval,
      ease_factor: next.ease_factor,
      review_count: next.review_count,
      next_review_at: next.next_review_at,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("hanzi", hanzi);

  if (error) {
    logger.warn("gradeCard error", error.message);
    return null;
  }
  return next;
}

/**
 * Create a new saved_words row. Uses upsert so adding the same hanzi twice
 * is a no-op (existing review state preserved).
 */
export async function addWord(params: {
  userId: string;
  hanzi: string;
  pinyin: string;
  english: string;
  hskLevel?: number;
  contextSentence?: string | null;
}): Promise<SavedWord | null> {
  const now = new Date().toISOString();
  const row = {
    user_id: params.userId,
    hanzi: params.hanzi.trim(),
    pinyin: params.pinyin.trim(),
    english: params.english.trim(),
    hsk_level: params.hskLevel ?? 0,
    saved_at: now,
    review_count: 0,
    srs_interval: 1,
    ease_factor: 2.5,
    next_review_at: now,
    context_sentence: params.contextSentence ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("saved_words")
    .upsert(row, { onConflict: "user_id,hanzi", ignoreDuplicates: false })
    .select(WORD_COLUMNS)
    .single();

  if (error) {
    logger.warn("addWord error", error.message);
    return null;
  }
  return data as SavedWord;
}

export async function deleteWord(userId: string, hanzi: string): Promise<boolean> {
  const { error } = await supabase
    .from("saved_words")
    .delete()
    .eq("user_id", userId)
    .eq("hanzi", hanzi);
  if (error) {
    logger.warn("deleteWord error", error.message);
    return false;
  }
  return true;
}
