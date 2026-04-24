import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Button, Text } from "@/components/ui";
import type { WordOrderQuestion } from "@/features/exercises/types";
import { useTheme } from "@/theme";

type Props = {
  question: WordOrderQuestion;
  onResult: (correct: boolean) => void;
};

/**
 * Tap-to-add sentence builder. Each token is a unique key (index-tagged) so
 * duplicates don't conflict. The bank at the bottom shrinks as the user
 * adds tokens to the top row; tapping a placed token removes it.
 */
export function WordOrderCard({ question, onResult }: Props) {
  const theme = useTheme();

  // Give every shuffled token a stable key (token + index in shuffle).
  const bank = useMemo(
    () => question.shuffled.map((t, i) => ({ id: `${i}:${t}`, token: t })),
    [question.shuffled],
  );

  const [placed, setPlaced] = useState<Array<{ id: string; token: string }>>([]);
  const [revealed, setRevealed] = useState<"correct" | "wrong" | null>(null);

  const remaining = bank.filter((b) => !placed.some((p) => p.id === b.id));

  function add(item: { id: string; token: string }) {
    if (revealed) return;
    setPlaced((prev) => [...prev, item]);
  }

  function remove(id: string) {
    if (revealed) return;
    setPlaced((prev) => prev.filter((p) => p.id !== id));
  }

  function check() {
    if (placed.length !== question.answer.length) return;
    const userString = placed.map((p) => p.token).join("");
    const expected = question.answer.join("");
    const correct = userString === expected;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setRevealed(correct ? "correct" : "wrong");
    setTimeout(() => onResult(correct), 900);
  }

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
        <Text variant="caption" color="tertiary">
          Build the sentence
        </Text>
        <Text variant="body" color="secondary" align="center">
          {question.english}
        </Text>
      </View>

      {/* Placed row */}
      <View
        style={{
          minHeight: 72,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderWidth: 2,
          borderColor:
            revealed === "correct"
              ? theme.colors.success
              : revealed === "wrong"
                ? theme.colors.danger
                : theme.colors.border,
          backgroundColor: theme.colors.surface,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.spacing.sm,
          alignItems: "center",
        }}
      >
        {placed.length === 0 ? (
          <Text variant="small" color="tertiary">
            Tap tokens below in order…
          </Text>
        ) : (
          placed.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => remove(p.id)}
              disabled={revealed !== null}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.accent,
              }}
            >
              <Text chinese variant="bodyStrong" color="onAccent">
                {p.token}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Bank */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.spacing.sm,
          justifyContent: "center",
          minHeight: 64,
        }}
      >
        {remaining.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => add(b)}
            disabled={revealed !== null}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.bg,
            }}
          >
            <Text chinese variant="bodyStrong">
              {b.token}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        label={revealed === "wrong" ? "Wrong — see answer" : "Check"}
        disabled={placed.length !== question.answer.length || revealed !== null}
        onPress={check}
        size="lg"
        fullWidth
      />

      {revealed === "wrong" ? (
        <Text chinese variant="body" color="secondary" align="center">
          Correct: {question.answer.join("")}
        </Text>
      ) : null}
    </View>
  );
}
