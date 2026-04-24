import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import type { MatchPairsQuestion } from "@/features/exercises/types";
import { useTheme } from "@/theme";

type Props = {
  question: MatchPairsQuestion;
  onResult: (correct: boolean) => void;
};

type Side = "hanzi" | "english";

export function MatchPairsCard({ question, onResult }: Props) {
  const theme = useTheme();
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ hanzi: string | null; english: string | null }>({
    hanzi: null,
    english: null,
  });
  const [selectedHanzi, setSelectedHanzi] = useState<string | null>(null);
  const [selectedEnglish, setSelectedEnglish] = useState<string | null>(null);

  const pairs = question.pairs;

  // Fixed shuffle for each side so layout doesn't jump as matches happen.
  const hanziCol = useMemo(() => [...pairs].sort(() => Math.random() - 0.5), [pairs]);
  const englishCol = useMemo(() => [...pairs].sort(() => Math.random() - 0.5), [pairs]);

  function tryMatch(h: string, e: string) {
    const pair = pairs.find((p) => p.hanzi === h && p.english === e);
    if (pair) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const next = new Set(matched);
      next.add(pair.hanzi);
      setMatched(next);
      setSelectedHanzi(null);
      setSelectedEnglish(null);
      if (next.size === pairs.length) {
        setTimeout(() => onResult(true), 400);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setWrong({ hanzi: h, english: e });
      setTimeout(() => {
        setWrong({ hanzi: null, english: null });
        setSelectedHanzi(null);
        setSelectedEnglish(null);
      }, 450);
    }
  }

  function onPick(side: Side, value: string) {
    if (side === "hanzi") {
      if (matched.has(value)) return;
      setSelectedHanzi(value);
      if (selectedEnglish) tryMatch(value, selectedEnglish);
    } else {
      const pair = pairs.find((p) => p.english === value);
      if (pair && matched.has(pair.hanzi)) return;
      setSelectedEnglish(value);
      if (selectedHanzi) tryMatch(selectedHanzi, value);
    }
  }

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
        <Text variant="caption" color="tertiary">
          Match pairs
        </Text>
        <Text variant="body" color="secondary" align="center">
          Tap a hanzi, then tap its meaning.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          {hanziCol.map((p) => {
            const isMatched = matched.has(p.hanzi);
            const isSelected = selectedHanzi === p.hanzi;
            const isWrong = wrong.hanzi === p.hanzi;
            return (
              <Pressable
                key={p.hanzi}
                onPress={() => onPick("hanzi", p.hanzi)}
                disabled={isMatched}
                style={{
                  paddingVertical: theme.spacing.md,
                  borderRadius: theme.radii.md,
                  borderWidth: 2,
                  borderColor: isWrong
                    ? theme.colors.danger
                    : isMatched
                      ? theme.colors.success
                      : isSelected
                        ? theme.colors.accent
                        : theme.colors.border,
                  backgroundColor: isMatched ? theme.colors.surface : theme.colors.bg,
                  alignItems: "center",
                  opacity: isMatched ? 0.4 : 1,
                }}
              >
                <Text chinese variant="h3">
                  {p.hanzi}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          {englishCol.map((p) => {
            const pair = pairs.find((x) => x.english === p.english)!;
            const isMatched = matched.has(pair.hanzi);
            const isSelected = selectedEnglish === p.english;
            const isWrong = wrong.english === p.english;
            return (
              <Pressable
                key={p.english}
                onPress={() => onPick("english", p.english)}
                disabled={isMatched}
                style={{
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radii.md,
                  borderWidth: 2,
                  borderColor: isWrong
                    ? theme.colors.danger
                    : isMatched
                      ? theme.colors.success
                      : isSelected
                        ? theme.colors.accent
                        : theme.colors.border,
                  backgroundColor: isMatched ? theme.colors.surface : theme.colors.bg,
                  alignItems: "center",
                  minHeight: 48,
                  justifyContent: "center",
                  opacity: isMatched ? 0.4 : 1,
                }}
              >
                <Text variant="small" align="center" numberOfLines={2}>
                  {p.english}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text variant="caption" color="tertiary" align="center">
        {matched.size} / {pairs.length} matched
      </Text>
    </View>
  );
}
