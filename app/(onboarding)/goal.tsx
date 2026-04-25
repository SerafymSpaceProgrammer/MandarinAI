import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useOnboardingStore } from "@/stores/onboardingStore";
import type { LearningGoal } from "@/types";
import { useTheme } from "@/theme";

type Tile = {
  code: LearningGoal;
  emoji: string;
  label: string;
  hint: string;
};

export default function GoalStep() {
  const theme = useTheme();
  const t = useT();
  const selected = useOnboardingStore((s) => s.learning_goal);
  const setDraft = useOnboardingStore((s) => s.set);

  const TILES: Tile[] = [
    { code: "travel",      emoji: "✈️", label: t.onboarding.goal.travelLabel,      hint: t.onboarding.goal.travelHint },
    { code: "work",        emoji: "💼", label: t.onboarding.goal.workLabel,        hint: t.onboarding.goal.workHint },
    { code: "hsk_exam",    emoji: "📝", label: t.onboarding.goal.hskLabel,         hint: t.onboarding.goal.hskHint },
    { code: "immigration", emoji: "🇨🇳", label: t.onboarding.goal.immigrationLabel, hint: t.onboarding.goal.immigrationHint },
    { code: "fun",         emoji: "😊", label: t.onboarding.goal.funLabel,         hint: t.onboarding.goal.funHint },
  ];

  function pick(code: LearningGoal) {
    setDraft({ learning_goal: code });
    router.push("/(onboarding)/time");
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">{t.onboarding.goal.title}</Text>
          <Text variant="body" color="secondary">
            {t.onboarding.goal.hint}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {TILES.map((tile) => {
            const active = selected === tile.code;
            return (
              <Card
                key={tile.code}
                onPress={() => pick(tile.code)}
                accessibilityLabel={tile.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.lg,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  borderWidth: active ? 2 : 1,
                }}
                bordered
              >
                <Text style={{ fontSize: 32, lineHeight: 36 }}>{tile.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{tile.label}</Text>
                  <Text variant="small" color="secondary">
                    {tile.hint}
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
