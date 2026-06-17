import { supabase } from "@/api";
import { logger } from "@/lib/logger";

import type { SavedWord } from "@/features/vocab/vocab";

/**
 * A named user-created collection of words. The saved_words row owns the
 * SRS state; deck membership is purely a tagging layer on top, so the same
 * word can sit in multiple decks (e.g. both "HSK 3 weak" and "From lesson 7").
 */
export type UserDeck = {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  created_at: string;
  updated_at: string;
};

const DECK_COLUMNS = "id, user_id, name, emoji, created_at, updated_at";

/** List the user's decks, newest first. */
export async function listDecks(userId: string): Promise<UserDeck[]> {
  const { data, error } = await supabase
    .from("user_decks")
    .select(DECK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    logger.warn("listDecks error", error.message);
    return [];
  }
  return (data ?? []) as UserDeck[];
}

/**
 * Create a new deck. Returns the inserted row, or null on conflict / error.
 * The (user_id, name) unique constraint stops accidental duplicates.
 */
export async function createDeck(
  userId: string,
  name: string,
  emoji: string = "📚",
): Promise<UserDeck | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("user_decks")
    .insert({ user_id: userId, name: trimmed, emoji })
    .select(DECK_COLUMNS)
    .single();
  if (error) {
    logger.warn("createDeck error", error.message);
    return null;
  }
  return data as UserDeck;
}

export async function renameDeck(
  deckId: string,
  name: string,
  emoji?: string,
): Promise<UserDeck | null> {
  const patch: Record<string, unknown> = {
    name: name.trim(),
    updated_at: new Date().toISOString(),
  };
  if (emoji) patch.emoji = emoji;
  const { data, error } = await supabase
    .from("user_decks")
    .update(patch)
    .eq("id", deckId)
    .select(DECK_COLUMNS)
    .single();
  if (error) {
    logger.warn("renameDeck error", error.message);
    return null;
  }
  return data as UserDeck;
}

export async function deleteDeck(deckId: string): Promise<boolean> {
  const { error } = await supabase.from("user_decks").delete().eq("id", deckId);
  if (error) {
    logger.warn("deleteDeck error", error.message);
    return false;
  }
  return true;
}

/** Add a word (by hanzi) to a deck. Idempotent — on conflict does nothing. */
export async function addWordToDeck(
  deckId: string,
  hanzi: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("deck_words")
    .upsert(
      { deck_id: deckId, hanzi },
      { onConflict: "deck_id,hanzi", ignoreDuplicates: true },
    );
  if (error) {
    logger.warn("addWordToDeck error", error.message);
    return false;
  }
  return true;
}

export async function removeWordFromDeck(
  deckId: string,
  hanzi: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("deck_words")
    .delete()
    .eq("deck_id", deckId)
    .eq("hanzi", hanzi);
  if (error) {
    logger.warn("removeWordFromDeck error", error.message);
    return false;
  }
  return true;
}

/**
 * Decks the given hanzi belongs to (for the current user). Used by the save
 * sheet to show which decks already contain this word so the user can
 * toggle each membership independently.
 */
export async function fetchDecksForWord(
  userId: string,
  hanzi: string,
): Promise<UserDeck[]> {
  const { data, error } = await supabase
    .from("deck_words")
    .select(`deck_id, user_decks!inner(${DECK_COLUMNS})`)
    .eq("hanzi", hanzi)
    .eq("user_decks.user_id", userId);
  if (error) {
    logger.warn("fetchDecksForWord error", error.message);
    return [];
  }
  const rows = (data ?? []) as Array<{ user_decks: UserDeck | UserDeck[] }>;
  return rows.flatMap((r) =>
    Array.isArray(r.user_decks) ? r.user_decks : [r.user_decks],
  );
}

/** Per-deck word counts — small N (decks are user-scoped), one query each. */
export async function fetchDeckCounts(
  deckIds: string[],
): Promise<Record<string, number>> {
  if (deckIds.length === 0) return {};
  const counts: Record<string, number> = {};
  for (const id of deckIds) {
    const { count, error } = await supabase
      .from("deck_words")
      .select("hanzi", { count: "exact", head: true })
      .eq("deck_id", id);
    if (error) {
      logger.warn("fetchDeckCounts error", error.message);
      counts[id] = 0;
    } else {
      counts[id] = count ?? 0;
    }
  }
  return counts;
}

/**
 * Fetch the full SavedWord rows that belong to a deck. The deck stores only
 * (deck_id, hanzi) pairs; SRS state and meaning live in saved_words, so we
 * join on (user_id, hanzi). Words present in deck_words but missing from
 * saved_words are silently skipped — that's a stale row the user can
 * reclaim by re-saving.
 */
export async function fetchDeckCards(
  userId: string,
  deckId: string,
): Promise<SavedWord[]> {
  const { data: membership, error: mErr } = await supabase
    .from("deck_words")
    .select("hanzi")
    .eq("deck_id", deckId);
  if (mErr) {
    logger.warn("fetchDeckCards membership error", mErr.message);
    return [];
  }
  const hanziList = (membership ?? []).map((r) => r.hanzi as string);
  if (hanziList.length === 0) return [];
  const { data, error } = await supabase
    .from("saved_words")
    .select(
      "user_id, hanzi, pinyin, english, hsk_level, saved_at, review_count, srs_interval, ease_factor, next_review_at, context_sentence, updated_at",
    )
    .eq("user_id", userId)
    .in("hanzi", hanziList);
  if (error) {
    logger.warn("fetchDeckCards cards error", error.message);
    return [];
  }
  return (data ?? []) as SavedWord[];
}
