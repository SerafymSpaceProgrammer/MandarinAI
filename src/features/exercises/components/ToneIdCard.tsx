import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Volume2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import type { ToneIdQuestion } from "@/features/exercises/types";
import { useTheme } from "@/theme";

type Props = {
  question: ToneIdQuestion;
  onResult: (correct: boolean) => void;
};

const TONE_GLYPHS: Array<{ value: 1 | 2 | 3 | 4; glyph: string }> = [
  { value: 1, glyph: "ā" },
  { value: 2, glyph: "á" },
  { value: 3, glyph: "ǎ" },
  { value: 4, glyph: "à" },
];

export function ToneIdCard({ question, onResult }: Props) {
  const theme = useTheme();
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);

  const TONE_LABELS: Record<1 | 2 | 3 | 4, string> = {
    1: t.exercises.cards.tone1,
    2: t.exercises.cards.tone2,
    3: t.exercises.cards.tone3,
    4: t.exercises.cards.tone4,
  };

  function speak() {
    Speech.stop().catch(() => {});
    Speech.speak(question.word.hanzi, { language: "zh-CN", rate: 0.7 });
  }

  useEffect(() => {
    const id = setTimeout(speak, 200);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.word.hanzi]);

  function choose(tone: 1 | 2 | 3 | 4) {
    if (picked !== null) return;
    const correct = tone === question.tone;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(tone);
    setTimeout(() => onResult(correct), 800);
  }

  const toneColor: Record<1 | 2 | 3 | 4, string> = {
    1: theme.colors.tone1,
    2: theme.colors.tone2,
    3: theme.colors.tone3,
    4: theme.colors.tone4,
  };

  return (
    <View style={{ gap: theme.spacing.xl, alignItems: "center" }}>
      <Text variant="caption" color="tertiary">
        {t.exercises.cards.toneTitle}
      </Text>

      <Pressable
        onPress={speak}
        accessibilityLabel={t.vocab.review.tapToReplay}
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: theme.colors.accentMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Volume2 color={theme.colors.accent} size={42} strokeWidth={2} />
      </Pressable>

      <Text variant="small" color="tertiary">
        {t.exercises.cards.toneQuestion}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md, justifyContent: "center" }}>
        {TONE_GLYPHS.map((tone) => {
          const isPicked = picked === tone.value;
          const isCorrect = tone.value === question.tone;
          const showResult = picked !== null;
          const borderColor = showResult && isCorrect
            ? theme.colors.success
            : isPicked && !isCorrect
              ? theme.colors.danger
              : theme.colors.border;
          return (
            <Pressable
              key={tone.value}
              onPress={() => choose(tone.value)}
              disabled={picked !== null}
              style={{
                flexBasis: "45%",
                flexGrow: 1,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.radii.md,
                borderWidth: 2,
                borderColor,
                backgroundColor: theme.colors.surface,
                alignItems: "center",
                gap: 2,
              }}
            >
              <Text style={{ fontSize: 36, lineHeight: 40, color: toneColor[tone.value], fontWeight: "700" }}>
                {tone.glyph}
              </Text>
              <Text variant="small" color="secondary">
                {fmt(t.exercises.cards.toneOption, { n: tone.value, label: TONE_LABELS[tone.value] })}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
