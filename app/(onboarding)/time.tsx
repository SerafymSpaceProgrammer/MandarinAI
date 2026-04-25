import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useTheme } from "@/theme";

export default function TimeStep() {
  const theme = useTheme();
  const t = useT();
  const selected = useOnboardingStore((s) => s.daily_goal_minutes);
  const setDraft = useOnboardingStore((s) => s.set);

  const OPTIONS = [
    { minutes: 5,  label: t.onboarding.time.casual,    hint: t.onboarding.time.casualHint },
    { minutes: 15, label: t.onboarding.time.balanced,  hint: t.onboarding.time.balancedHint },
    { minutes: 30, label: t.onboarding.time.serious,   hint: t.onboarding.time.seriousHint },
    { minutes: 60, label: t.onboarding.time.intensive, hint: t.onboarding.time.intensiveHint },
  ];

  function pick(minutes: number) {
    setDraft({ daily_goal_minutes: minutes });
    router.push("/(onboarding)/notifications");
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">{t.onboarding.time.title}</Text>
          <Text variant="body" color="secondary">
            {t.onboarding.time.hint}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {OPTIONS.map((o) => {
            const active = selected === o.minutes;
            return (
              <Card
                key={o.minutes}
                onPress={() => pick(o.minutes)}
                accessibilityLabel={o.label}
                bordered
                style={{
                  gap: 2,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  borderWidth: active ? 2 : 1,
                }}
              >
                <Text variant="bodyStrong">{o.label}</Text>
                <Text variant="small" color="secondary">
                  {o.hint}
                </Text>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
