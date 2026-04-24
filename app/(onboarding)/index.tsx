import { useState } from "react";
import { View } from "react-native";

import { updateProfile } from "@/api";
import { Button, Screen, Text, useToast } from "@/components/ui";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

/**
 * Phase 1 onboarding placeholder.
 * Phase 2 will split this into: language → level → goal → time → notifications.
 * For now we just mark the profile onboarded so routing flips to the app.
 */
export default function OnboardingPlaceholder() {
  const theme = useTheme();
  const toast = useToast();
  const { session, refreshProfile } = useUserStore();
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (!session || busy) return;
    setBusy(true);
    const updated = await updateProfile(session.user.id, {
      onboarding_completed: true,
    });
    setBusy(false);
    if (updated) {
      await refreshProfile();
    } else {
      toast.error("Couldn't save. Please try again.");
    }
  }

  return (
    <Screen padded>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: theme.spacing.lg,
        }}
      >
        <Text variant="display" chinese style={{ color: theme.colors.accent }}>
          你好
        </Text>
        <Text variant="h2" align="center">
          Welcome to MandarinAI
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ paddingHorizontal: theme.spacing.xl }}>
          Full onboarding (language, level, goals, daily time, notifications) arrives in Phase 2.
          For now, tap below to enter the app.
        </Text>
        <View style={{ height: theme.spacing["2xl"] }} />
        <Button
          label="Let's go"
          onPress={finish}
          loading={busy}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}
