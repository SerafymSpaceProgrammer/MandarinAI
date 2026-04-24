import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import type { SavedWord } from "@/features/vocab/vocab";
import { useTheme } from "@/theme";

type Props = {
  card: SavedWord;
  /** Called once the user reveals the back — unlocks the grade buttons. */
  onRevealed: () => void;
};

/**
 * Tap-to-reveal recognition card. Front = hanzi, back = pinyin + meaning.
 */
export function RecognitionCard({ card, onRevealed }: Props) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    onRevealed();
  }

  return (
    <Pressable
      onPress={reveal}
      accessibilityLabel="Reveal answer"
      accessibilityHint="Shows pinyin and meaning"
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing["2xl"],
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.xl,
      }}
    >
      <Text variant="caption" color="tertiary">
        Recognize
      </Text>

      <Text
        chinese
        style={{
          fontSize: 84,
          lineHeight: 96,
          fontWeight: "700",
          color: theme.colors.textPrimary,
          textAlign: "center",
        }}
      >
        {card.hanzi}
      </Text>

      {revealed ? (
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Text variant="pinyin" color="accent">
            {card.pinyin}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {card.english}
          </Text>
          {card.context_sentence ? (
            <Text
              chinese
              variant="body"
              color="tertiary"
              align="center"
              style={{ marginTop: theme.spacing.sm, fontStyle: "italic" }}
            >
              {card.context_sentence}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="small" color="tertiary">
          Tap to reveal
        </Text>
      )}
    </Pressable>
  );
}
