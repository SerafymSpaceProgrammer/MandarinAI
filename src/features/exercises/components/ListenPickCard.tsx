import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Volume2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import type { ListenPickQuestion } from "@/features/exercises/types";
import { useTheme } from "@/theme";

type Props = {
  question: ListenPickQuestion;
  onResult: (correct: boolean) => void;
};

export function ListenPickCard({ question, onResult }: Props) {
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);

  const target = question.word.hanzi;

  function speak() {
    Speech.stop().catch(() => {});
    Speech.speak(target, { language: "zh-CN", rate: 0.85 });
  }

  useEffect(() => {
    const id = setTimeout(speak, 250);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  function choose(option: string) {
    if (picked) return;
    const correct = option === target;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(option);
    setTimeout(() => onResult(correct), 700);
  }

  return (
    <View style={{ gap: theme.spacing.xl, alignItems: "center" }}>
      <Text variant="caption" color="tertiary">
        Listen
      </Text>

      <Pressable
        onPress={speak}
        accessibilityLabel="Replay"
        style={{
          width: 104,
          height: 104,
          borderRadius: 52,
          backgroundColor: theme.colors.accentMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Volume2 color={theme.colors.accent} size={48} strokeWidth={2} />
      </Pressable>

      <Text variant="small" color="tertiary">
        Tap to replay
      </Text>

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md, justifyContent: "center" }}
      >
        {question.options.map((opt) => {
          const isPicked = picked === opt;
          const isCorrect = opt === target;
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
