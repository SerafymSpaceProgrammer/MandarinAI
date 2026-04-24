import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import { logger } from "@/lib/logger";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useTheme } from "@/theme";

type TimeOption = {
  label: string;
  value: string; // "HH:MM:SS" for Postgres time
  emoji: string;
};

const TIME_OPTIONS: TimeOption[] = [
  { label: "Morning · 8:00",   value: "08:00:00", emoji: "🌅" },
  { label: "Noon · 12:00",     value: "12:00:00", emoji: "☀️" },
  { label: "Evening · 18:00",  value: "18:00:00", emoji: "🌆" },
  { label: "Night · 21:00",    value: "21:00:00", emoji: "🌙" },
];

const DEFAULT_TIME = "19:00:00";

export default function NotificationsStep() {
  const theme = useTheme();
  const setDraft = useOnboardingStore((s) => s.set);
  const current = useOnboardingStore((s) => s.notification_time) ?? DEFAULT_TIME;
  const [busy, setBusy] = useState(false);

  async function enableAndContinue() {
    setBusy(true);
    let granted = false;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        granted = true;
      } else {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.status === "granted";
      }
    } catch (err) {
      logger.warn("notification permission error", err);
    }
    setBusy(false);

    setDraft({
      notification_enabled: granted,
      notification_time: granted ? current : null,
    });
    router.push("/(onboarding)/done");
  }

  function skipAndContinue() {
    setDraft({ notification_enabled: false, notification_time: null });
    router.push("/(onboarding)/done");
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">Daily reminder?</Text>
          <Text variant="body" color="secondary">
            One friendly nudge per day. No spam, no streak-guilt.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" color="tertiary">
            Remind me at
          </Text>
          {TIME_OPTIONS.map((t) => {
            const active = current === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setDraft({ notification_time: t.value })}
                accessibilityLabel={t.label}
                style={{
                  padding: theme.spacing.lg,
                  borderRadius: theme.radii.md,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.md,
                }}
              >
                <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
                <Text variant="bodyStrong">{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Enable notifications"
            onPress={enableAndContinue}
            loading={busy}
            size="lg"
            fullWidth
          />
          <Button
            label="Not now"
            variant="ghost"
            onPress={skipAndContinue}
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
