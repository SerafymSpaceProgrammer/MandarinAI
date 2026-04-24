import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import type { FillBlankQuestion } from "@/features/exercises/types";
import { useTheme } from "@/theme";

type Props = {
  question: FillBlankQuestion;
  onResult: (correct: boolean) => void;
};

export function FillBlankCard({ question, onResult }: Props) {
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);

  function choose(option: string) {
    if (picked) return;
    const correct = option === question.correct;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(option);
    setTimeout(() => onResult(correct), 700);
  }

  // Render sentence with the blank highlighted — or with the pick filled in
  // after the user answers.
  const filledSentence = picked
    ? question.sentenceWithBlank.replace(
        "___",
        picked === question.correct ? question.correct : `[${picked}]`,
      )
    : question.sentenceWithBlank;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
        <Text variant="caption" color="tertiary">
          Fill the blank
        </Text>
        <View
          style={{
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text chinese variant="h3" align="center">
            {filledSentence}
          </Text>
        </View>
        <Text variant="small" color="secondary" align="center">
          {question.english}
        </Text>
      </View>

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md, justifyContent: "center" }}
      >
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
                flexBasis: "45%",
                flexGrow: 1,
                paddingVertical: theme.spacing.lg,
                borderRadius: theme.radii.md,
                borderWidth: 2,
                borderColor,
                backgroundColor: theme.colors.surface,
                alignItems: "center",
              }}
            >
              <Text chinese variant="h2">
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
