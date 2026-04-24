import { supabase } from "@/api";
import { logger } from "@/lib/logger";

export type CharacterDictRow = {
  hanzi: string;
  pinyin: string[];
  meanings: string[];
  hsk_level: number | null;
  frequency_rank: number | null;
  stroke_count: number | null;
  mnemonic_en: string | null;
  stroke_order_svg: string | null;
};

export type UserCharacter = {
  hanzi: string;
  step_completed: number; // 0-5; 5 = mastered
  reps: number;
  due_at: string;
  mnemonic_user_override: string | null;
  last_seen_at: string | null;
};

export type CharacterWithProgress = CharacterDictRow & {
  progress: UserCharacter | null;
};

const DICT_COLUMNS =
  "hanzi, pinyin, meanings, hsk_level, frequency_rank, stroke_count, mnemonic_en, stroke_order_svg";

const USER_COLUMNS =
  "hanzi, step_completed, reps, due_at, mnemonic_user_override, last_seen_at";

export async function fetchDict(hskLevel?: number): Promise<CharacterDictRow[]> {
  let q = supabase.from("characters_dict").select(DICT_COLUMNS).order("frequency_rank", { ascending: true });
  if (hskLevel !== undefined) q = q.eq("hsk_level", hskLevel);
  const { data, error } = await q;
  if (error) {
    logger.warn("fetchDict error", error.message);
    return [];
  }
  return (data ?? []) as CharacterDictRow[];
}

export async function fetchOneFromDict(hanzi: string): Promise<CharacterDictRow | null> {
  const { data, error } = await supabase
    .from("characters_dict")
    .select(DICT_COLUMNS)
    .eq("hanzi", hanzi)
    .maybeSingle();
  if (error) {
    logger.warn("fetchOneFromDict error", error.message);
    return null;
  }
  return (data as CharacterDictRow | null) ?? null;
}

export async function fetchUserCharacters(userId: string): Promise<UserCharacter[]> {
  const { data, error } = await supabase
    .from("user_characters")
    .select(USER_COLUMNS)
    .eq("user_id", userId);
  if (error) {
    logger.warn("fetchUserCharacters error", error.message);
    return [];
  }
  return (data ?? []) as UserCharacter[];
}

export async function fetchUserCharacter(
  userId: string,
  hanzi: string,
): Promise<UserCharacter | null> {
  const { data, error } = await supabase
    .from("user_characters")
    .select(USER_COLUMNS)
    .eq("user_id", userId)
    .eq("hanzi", hanzi)
    .maybeSingle();
  if (error) {
    logger.warn("fetchUserCharacter error", error.message);
    return null;
  }
  return (data as UserCharacter | null) ?? null;
}

/**
 * Merge dict rows with user progress. Characters without a user_characters
 * row are considered step_completed=0.
 */
export function joinWithProgress(
  dict: CharacterDictRow[],
  progress: UserCharacter[],
): CharacterWithProgress[] {
  const byHanzi = new Map(progress.map((p) => [p.hanzi, p]));
  return dict.map((d) => ({ ...d, progress: byHanzi.get(d.hanzi) ?? null }));
}

/**
 * Advance a character to at least `step`, and (re)schedule its next review.
 * Step 0 is the pre-learned state — this function only ever goes forward.
 *
 * Spacing for re-review: 1d at step 1, 2d at step 2, 4d at step 3, 7d at
 * step 4, 14d at mastered. Simple enough for the intro flow; full FSRS
 * comes later when the character trainer enters reinforcement mode.
 */
const INTERVAL_DAYS = [0, 1, 2, 4, 7, 14] as const;

export async function advanceStep(
  userId: string,
  hanzi: string,
  nextStep: number,
): Promise<UserCharacter | null> {
  const step = Math.max(0, Math.min(5, nextStep));
  const days = INTERVAL_DAYS[step] ?? 7;
  const dueAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const now = new Date().toISOString();

  const existing = await fetchUserCharacter(userId, hanzi);
  const reps = (existing?.reps ?? 0) + 1;

  const row = {
    user_id: userId,
    hanzi,
    step_completed: Math.max(existing?.step_completed ?? 0, step),
    reps,
    due_at: dueAt,
    last_seen_at: now,
    updated_at: now,
    mnemonic_user_override: existing?.mnemonic_user_override ?? null,
  };

  const { data, error } = await supabase
    .from("user_characters")
    .upsert(row, { onConflict: "user_id,hanzi" })
    .select(USER_COLUMNS)
    .single();

  if (error) {
    logger.warn("advanceStep error", error.message);
    return null;
  }
  return data as UserCharacter;
}

export const STEP_LABELS = ["Learn", "Recognize", "Pronounce", "Write", "Produce"] as const;
