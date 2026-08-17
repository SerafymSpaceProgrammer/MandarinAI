import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Volume2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
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
  const t = useT();
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
        {t.vocab.review.produce}
      </Text>

      <Text variant="h2" align="center">
        {card.english}
      </Text>
      <Text variant="small" color="secondary">
        {t.vocab.review.produceHint}
      </Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!revealed}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t.vocab.review.hanziPlaceholder}
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
            {correct ? t.vocab.review.exactMatch : t.vocab.review.notQuite}
          </Text>
          <Pressable
            onPress={() => {
              Speech.stop().catch(() => {});
              Speech.speak(card.hanzi, { language: "zh-CN", rate: 0.9 });
            }}
            hitSlop={10}
            accessibilityLabel={t.vocab.review.speak}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: theme.spacing.sm,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: theme.radii.full,
              backgroundColor: theme.colors.accentMuted,
            }}
          >
            <Volume2 color={theme.colors.accent} size={14} strokeWidth={2.2} />
            <Text variant="small" color="accent">
              {t.vocab.review.speak}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Button label={t.vocab.review.check} onPress={check} fullWidth disabled={value.trim().length === 0} />
      )}
    </View>
  );
}
