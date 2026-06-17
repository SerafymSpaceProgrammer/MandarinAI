export type NativeLanguage =
  | "en"
  | "es"
  | "pt"
  | "ru"
  | "zh"
  | "uk"
  | "de"
  | "pl";
export type LearningGoal = "travel" | "work" | "hsk_exam" | "immigration" | "fun";
export type AppThemeId =
  | "system"
  | "light"
  | "dark"
  | "sakura"
  | "bamboo"
  | "midnight"
  | "parchment";

export type SubscriptionTier = "free" | "pro" | "lifetime";
export type SubscriptionStatus =
  | "active"
  | "on_trial"
  | "cancelled"
  | "expired"
  | "past_due"
  | null;

/**
 * Shape of the `profiles` row we care about on the mobile side.
 * The `profiles` table is shared with the ChineseLens extension. Billing
 * columns (tier, ls_*, current_period_end, status) are populated by the
 * shared `lemonsqueezy-webhook` edge function whenever the user buys or
 * cancels in either surface — so the mobile app always reflects the
 * latest tier without having to talk to LemonSqueezy itself.
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
  app_theme: AppThemeId;
  // Billing — mirrors columns set by the LemonSqueezy webhook.
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_end: string | null;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  ls_variant_id: string | null;
};

export type ProfileUpdate = Partial<Omit<Profile, "id">>;
