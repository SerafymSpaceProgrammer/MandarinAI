export type NativeLanguage = "en" | "es" | "pt" | "ru" | "zh";
export type LearningGoal = "travel" | "work" | "hsk_exam" | "immigration" | "fun";

/**
 * Shape of the `profiles` row we care about on the mobile side.
 * The `profiles` table is shared with the ChineseLens extension and may
 * contain extra columns (tier, ls_customer_id, …) that we simply ignore.
 */
export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  hsk_level: number;
  native_language: NativeLanguage;
  daily_goal_minutes: number;
  learning_goal: LearningGoal | null;
  notification_time: string | null;
  notification_enabled: boolean;
  timezone: string;
  onboarding_completed: boolean;
};

export type ProfileUpdate = Partial<Omit<Profile, "id">>;
