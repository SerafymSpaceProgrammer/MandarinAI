import { create } from "zustand";

import type { LearningGoal, NativeLanguage } from "@/types";

/**
 * Scratch state collected while the user walks through the onboarding flow.
 * Flushed to `profiles` in a single updateProfile() call on the Done screen.
 * Intentionally in-memory only — if the app is backgrounded mid-flow, we
 * restart the flow. (All fields are re-pickable in Settings later.)
 */
export type OnboardingDraft = {
  native_language: NativeLanguage | null;
  hsk_level: number | null;
  learning_goal: LearningGoal | null;
  daily_goal_minutes: number | null;
  notification_enabled: boolean;
  notification_time: string | null; // "HH:MM:SS" matching Postgres time
};

type OnboardingStore = OnboardingDraft & {
  set: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
};

const initial: OnboardingDraft = {
  native_language: null,
  hsk_level: null,
  learning_goal: null,
  daily_goal_minutes: null,
  notification_enabled: true,
  notification_time: null,
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set(initial),
}));
