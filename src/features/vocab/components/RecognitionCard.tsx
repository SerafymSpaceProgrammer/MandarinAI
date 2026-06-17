import * as Speech from "expo-speech";
import { PenTool, Volume2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { StrokeViewerModal } from "@/components/StrokeViewerModal";
import { Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import type { SavedWord } from "@/features/vocab/vocab";
import { useTheme } from "@/theme";

type Props = {
  card: SavedWord;
  /** Called once the user reveals the back — unlocks the grade buttons. */
  onRevealed: () => void;
};

/**
 * Tap-to-reveal recognition card. Front = hanzi, back = pinyin + meaning +
 * a stroke-order shortcut.
 */
export function RecognitionCard({ card, onRevealed }: Props) {
  const theme = useTheme();
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  const [showStrokes, setShowStrokes] = useState(false);

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    onRevealed();
  }

  function speak() {
    Speech.stop().catch(() => {});
    Speech.speak(card.hanzi, { language: "zh-CN", rate: 0.9 });
  }

  return (
    <>
      <Pressable
        onPress={reveal}
        accessibilityLabel={t.vocab.review.tapToReveal}
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
          {t.vocab.review.recognize}
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

            <View
              style={{
                flexDirection: "row",
                gap: theme.spacing.sm,
                marginTop: theme.spacing.sm,
              }}
            >
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  speak();
                }}
                hitSlop={10}
                accessibilityLabel="Озвучить"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: theme.radii.full,
                  backgroundColor: theme.colors.accentMuted,
                }}
              >
                <Volume2 color={theme.colors.accent} size={14} strokeWidth={2.2} />
                <Text variant="small" color="accent">
                  Озвучить
                </Text>
              </Pressable>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setShowStrokes(true);
                }}
                hitSlop={10}
                accessibilityLabel={t.strokes.title}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: theme.radii.full,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <PenTool color={theme.colors.accent} size={14} strokeWidth={2.2} />
                <Text variant="small" color="accent">
                  {t.strokes.title}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text variant="small" color="tertiary">
            {t.vocab.review.tapToReveal}
          </Text>
        )}
      </Pressable>

      <StrokeViewerModal
        visible={showStrokes}
        onClose={() => setShowStrokes(false)}
        hanzi={card.hanzi}
        pinyin={card.pinyin}
        english={card.english}
      />
    </>
  );
}
