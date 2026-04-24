import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import type { TranslateQuestion } from "@/features/exercises/types";
import { useTheme } from "@/theme";

type Props = {
  question: TranslateQuestion;
  onResult: (correct: boolean) => void;
};

export function TranslateCard({ question, onResult }: Props) {
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);

  const prompt = question.direction === "zh_to_en" ? question.word.hanzi : question.word.english;
  const subPrompt =
    question.direction === "zh_to_en" ? question.word.pinyin : "Pick the hanzi";

  function choose(option: string) {
    if (picked) return;
    const correct = option === question.correct;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(option);
    setTimeout(() => onResult(correct), 700);
  }

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
        <Text variant="caption" color="tertiary">
          Translate
        </Text>
        {question.direction === "zh_to_en" ? (
          <Text chinese style={{ fontSize: 56, lineHeight: 64, fontWeight: "700" }}>
            {prompt}
          </Text>
        ) : (
          <Text variant="h1" align="center">
            {prompt}
          </Text>
        )}
        <Text variant="small" color="secondary">
          {subPrompt}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {question.options.map((opt) => {
          const isPicked = picked === opt;
          const isCorrect = opt === question.correct;
          const borderColor =
            picked && isCorrect
              ? theme.colors.success
              : isPicked && !isCorrect
                ? theme.colors.danger
                : theme.colors.border;
          return (
            <Pressable
              key={opt}
              onPress={() => choose(opt)}
              disabled={picked !== null}
              style={{
                padding: theme.spacing.lg,
                borderRadius: theme.radii.md,
                borderWidth: 2,
                borderColor,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Text
                chinese={question.direction === "en_to_zh"}
                variant={question.direction === "en_to_zh" ? "h3" : "body"}
                align="center"
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
