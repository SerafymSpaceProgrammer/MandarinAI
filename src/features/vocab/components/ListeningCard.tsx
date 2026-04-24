import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Volume2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import type { SavedWord } from "@/features/vocab/vocab";
import { useTheme } from "@/theme";

type Props = {
  card: SavedWord;
  distractors: SavedWord[];
  onRevealed: () => void;
};

/**
 * Play the hanzi via expo-speech (Mandarin voice). User picks from 4 hanzi
 * tiles (the correct one + 3 distractors drawn from the session).
 */
export function ListeningCard({ card, distractors, onRevealed }: Props) {
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo(() => {
    const pool = [card, ...distractors.slice(0, 3)];
    // shuffle
    return [...pool].sort(() => Math.random() - 0.5);
  }, [card, distractors]);

  function speak() {
    Speech.stop().catch(() => {});
    Speech.speak(card.hanzi, { language: "zh-CN", rate: 0.9 });
  }

  useEffect(() => {
    // Auto-play when the card first mounts.
    const id = setTimeout(() => speak(), 200);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.hanzi]);

  function choose(hanzi: string) {
    if (picked) return;
    const correct = hanzi === card.hanzi;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(hanzi);
    onRevealed();
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing["2xl"],
        gap: theme.spacing.xl,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ alignItems: "center", gap: theme.spacing.md }}>
        <Text variant="caption" color="tertiary">
          Listen
        </Text>

        <Pressable
          onPress={speak}
          accessibilityLabel="Play audio again"
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
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.spacing.md,
          justifyContent: "center",
        }}
      >
        {options.map((o) => {
          const isPicked = picked === o.hanzi;
          const isCorrect = o.hanzi === card.hanzi;
          const showCorrect = picked !== null && isCorrect;
          const showWrong = isPicked && !isCorrect;

          return (
            <Pressable
              key={o.hanzi}
              onPress={() => choose(o.hanzi)}
              disabled={picked !== null}
              style={{
                flexBasis: "45%",
                flexGrow: 1,
                paddingVertical: theme.spacing.lg,
                borderRadius: theme.radii.md,
                borderWidth: 2,
                borderColor: showCorrect
                  ? theme.colors.success
                  : showWrong
                    ? theme.colors.danger
                    : theme.colors.border,
                backgroundColor: theme.colors.bg,
                alignItems: "center",
              }}
            >
              <Text chinese variant="h2">
                {o.hanzi}
              </Text>
              {picked !== null ? (
                <Text variant="small" color={isCorrect ? "success" : showWrong ? "danger" : "tertiary"}>
                  {o.pinyin}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
