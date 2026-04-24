import { supabase } from "./supabase";
import type { Profile, ProfileUpdate } from "@/types";
import { logger } from "@/lib/logger";

const PROFILE_COLUMNS =
  "id, display_name, avatar_url, hsk_level, native_language, daily_goal_minutes, learning_goal, notification_time, notification_enabled, timezone, onboarding_completed, app_theme";

/**
 * Fetch the current user's profile. The row is auto-created by a DB trigger
 * on sign-up, but in case we race the trigger (or the user is legacy from the
 * extension) we self-heal by inserting an empty row.
 */
export async function fetchOrCreateProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logger.warn("fetchProfile error", error.message);
    return null;
  }

  if (data) return data as Profile;

  // Row missing — create defaults.
  const { data: inserted, error: insertErr } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select(PROFILE_COLUMNS)
    .single();

  if (insertErr) {
    logger.warn("createProfile error", insertErr.message);
    return null;
  }
  return inserted as Profile;
}

export async function updateProfile(
  userId: string,
  patch: ProfileUpdate,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    logger.warn("updateProfile error", error.message);
    return null;
  }
  return data as Profile;
}
