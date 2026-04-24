import * as Haptics from "expo-haptics";
import { useState } from "react";
import { TextInput, View } from "react-native";

import { Button, Text } from "@/components/ui";
import type { SavedWord } from "@/features/vocab/vocab";
import { useTheme } from "@/theme";

type Props = {
  card: SavedWord;
  onRevealed: () => void;
};

/**
 * Show the English meaning; user types the hanzi. We grade softly — mere
 * "were you close?" is enough, the final grade comes from the Again/Good/Easy
 * buttons the review screen renders underneath.
 */
export function ProductionCard({ card, onRevealed }: Props) {
  const theme = useTheme();
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);

  const correct = value.trim() === card.hanzi;

  function check() {
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setRevealed(true);
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
        justifyContent: "center",
      }}
    >
      <Text variant="caption" color="tertiary">
        Produce
      </Text>

      <Text variant="h2" align="center">
        {card.english}
      </Text>
      <Text variant="small" color="secondary">
        Write it in Chinese.
      </Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!revealed}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="汉字"
        placeholderTextColor={theme.colors.textTertiary}
        style={{
          minWidth: 200,
          textAlign: "center",
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          borderWidth: 2,
          borderColor: revealed
            ? correct
              ? theme.colors.success
              : theme.colors.danger
            : theme.colors.border,
          backgroundColor: theme.colors.bg,
          fontSize: 36,
          color: theme.colors.textPrimary,
          fontFamily: theme.fonts.chinese,
        }}
      />

      {revealed ? (
        <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
          <Text
            chinese
            style={{ fontSize: 28, fontWeight: "700", color: theme.colors.textPrimary }}
          >
            {card.hanzi}
          </Text>
          <Text variant="pinyin" color="accent">
            {card.pinyin}
          </Text>
          <Text variant="small" color={correct ? "success" : "danger"}>
            {correct ? "Exact match" : "Not quite — that's the correct answer"}
          </Text>
        </View>
      ) : (
        <Button label="Check" onPress={check} fullWidth disabled={value.trim().length === 0} />
      )}
    </View>
  );
}
