import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useOnboardingStore } from "@/stores/onboardingStore";
import type { LearningGoal } from "@/types";
import { useTheme } from "@/theme";

type Tile = {
  code: LearningGoal;
  emoji: string;
  label: string;
  hint: string;
};

const TILES: Tile[] = [
  { code: "travel",      emoji: "✈️", label: "Travel",        hint: "Order food, ask directions, navigate trips" },
  { code: "work",        emoji: "💼", label: "Work",          hint: "Business Mandarin for meetings and email" },
  { code: "hsk_exam",    emoji: "📝", label: "HSK exam",      hint: "Pass a specific level" },
  { code: "immigration", emoji: "🇨🇳", label: "Immigration",   hint: "Living in a Mandarin-speaking country" },
  { code: "fun",         emoji: "😊", label: "Fun",           hint: "No pressure — I just enjoy it" },
];

export default function GoalStep() {
  const theme = useTheme();
  const selected = useOnboardingStore((s) => s.learning_goal);
  const setDraft = useOnboardingStore((s) => s.set);

  function pick(code: LearningGoal) {
    setDraft({ learning_goal: code });
    router.push("/(onboarding)/time");
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">Why are you learning?</Text>
          <Text variant="body" color="secondary">
            We'll tune suggestions to match your goal.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {TILES.map((t) => {
            const active = selected === t.code;
            return (
              <Card
                key={t.code}
                onPress={() => pick(t.code)}
                accessibilityLabel={t.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.lg,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  borderWidth: active ? 2 : 1,
                }}
                bordered
              >
                <Text style={{ fontSize: 32, lineHeight: 36 }}>{t.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{t.label}</Text>
                  <Text variant="small" color="secondary">
                    {t.hint}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
