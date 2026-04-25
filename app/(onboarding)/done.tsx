import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { updateProfile } from "@/api";
import { Button, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function DoneStep() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const { session, refreshProfile } = useUserStore();
  const draft = useOnboardingStore();
  const resetDraft = useOnboardingStore((s) => s.reset);
  const [busy, setBusy] = useState(false);

  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: theme.duration.emphasis,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.1,
          duration: 350,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scale, fade, theme.duration.emphasis]);

  async function finish() {
    if (!session || busy) return;
    setBusy(true);
    const updated = await updateProfile(session.user.id, {
      native_language: draft.native_language ?? "en",
      hsk_level: draft.hsk_level ?? 1,
      learning_goal: draft.learning_goal ?? null,
      daily_goal_minutes: draft.daily_goal_minutes ?? 15,
      notification_enabled: draft.notification_enabled,
      notification_time: draft.notification_time ?? null,
      onboarding_completed: true,
    });
    setBusy(false);

    if (!updated) {
      toast.error(t.onboarding.done.saveError);
      return;
    }
    resetDraft();
    await refreshProfile();
    // AuthGate in root _layout will route to (app)/(tabs) once the refreshed
    // profile lands.
  }

  return (
    <Screen padded>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.xl }}>
        <Animated.View style={{ transform: [{ scale }], opacity: fade }}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: theme.colors.accentMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text chinese style={{ fontSize: 64, lineHeight: 72, color: theme.colors.accent }}>
              加油
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fade, alignItems: "center", gap: theme.spacing.sm }}>
          <Text variant="h1" align="center">
            {t.onboarding.done.title}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {t.onboarding.done.hint}
          </Text>
        </Animated.View>

        <View style={{ height: theme.spacing["2xl"] }} />

        <Button
          label={t.onboarding.done.cta}
          onPress={finish}
          loading={busy}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}
