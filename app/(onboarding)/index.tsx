import { Redirect } from "expo-router";

import { useOnboardingStore } from "@/stores/onboardingStore";

export default function OnboardingIndex() {
  // Fresh session on every entry — any half-filled state from a previous
  // cancelled flow would be misleading.
  useOnboardingStore.getState().reset();
  return <Redirect href="/(onboarding)/language" />;
}
