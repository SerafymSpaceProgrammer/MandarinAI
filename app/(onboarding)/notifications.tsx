import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { logger } from "@/lib/logger";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useTheme } from "@/theme";

const DEFAULT_TIME = "19:00:00";

export default function NotificationsStep() {
  const theme = useTheme();
  const t = useT();
  const setDraft = useOnboardingStore((s) => s.set);
  const current = useOnboardingStore((s) => s.notification_time) ?? DEFAULT_TIME;
  const [busy, setBusy] = useState(false);

  const TIME_OPTIONS = [
    { label: t.onboarding.notifications.morning, value: "08:00:00", emoji: "🌅" },
    { label: t.onboarding.notifications.noon,    value: "12:00:00", emoji: "☀️" },
    { label: t.onboarding.notifications.evening, value: "18:00:00", emoji: "🌆" },
    { label: t.onboarding.notifications.night,   value: "21:00:00", emoji: "🌙" },
  ];

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
          <Text variant="h1">{t.onboarding.notifications.title}</Text>
          <Text variant="body" color="secondary">
            {t.onboarding.notifications.hint}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" color="tertiary">
            {t.onboarding.notifications.remindAt}
          </Text>
          {TIME_OPTIONS.map((opt) => {
            const active = current === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setDraft({ notification_time: opt.value })}
                accessibilityLabel={opt.label}
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
                <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                <Text variant="bodyStrong">{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={t.onboarding.notifications.enable}
            onPress={enableAndContinue}
            loading={busy}
            size="lg"
            fullWidth
          />
          <Button
            label={t.onboarding.notifications.notNow}
            variant="ghost"
            onPress={skipAndContinue}
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
