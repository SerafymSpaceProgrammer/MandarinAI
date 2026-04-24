import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useTheme } from "@/theme";

type Option = {
  minutes: number;
  label: string;
  hint: string;
};

const OPTIONS: Option[] = [
  { minutes: 5,  label: "5 minutes",   hint: "Casual — a word or two a day" },
  { minutes: 15, label: "15 minutes",  hint: "Balanced — noticeable progress in weeks" },
  { minutes: 30, label: "30 minutes",  hint: "Serious — on track for HSK in months" },
  { minutes: 60, label: "60+ minutes", hint: "Intensive — you mean business" },
];

export default function TimeStep() {
  const theme = useTheme();
  const selected = useOnboardingStore((s) => s.daily_goal_minutes);
  const setDraft = useOnboardingStore((s) => s.set);

  function pick(minutes: number) {
    setDraft({ daily_goal_minutes: minutes });
    router.push("/(onboarding)/notifications");
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">How much time each day?</Text>
          <Text variant="body" color="secondary">
            Consistency beats intensity. Start small — you can change this later.
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
