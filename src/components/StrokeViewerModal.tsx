import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Modal, Text } from "@/components/ui";
import { StrokeAnimator } from "@/components/StrokeAnimator";
import { useTheme } from "@/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Single or multi-char word. Multi-char shows a tab strip. */
  hanzi: string;
  pinyin?: string;
  english?: string;
};

/**
 * Bottom-sheet viewer for stroke animations. Works for both single characters
 * and multi-character words (renders a tab strip so the user can step through
 * each hanzi individually — the data set is per-character).
 */
export function StrokeViewerModal({ visible, onClose, hanzi, pinyin, english }: Props) {
  const theme = useTheme();
  const chars = [...hanzi];
  const [idx, setIdx] = useState(0);

  // Reset to first char whenever the modal opens with a new word.
  const current = chars[Math.min(idx, chars.length - 1)] ?? hanzi;

  return (
    <Modal visible={visible} onClose={onClose} title="Stroke order">
      <View style={{ gap: theme.spacing.lg, alignItems: "center" }}>
        {pinyin || english ? (
          <View style={{ alignItems: "center", gap: 2 }}>
            {pinyin ? (
              <Text variant="pinyin" color="accent">
                {pinyin}
              </Text>
            ) : null}
            {english ? (
              <Text variant="body" color="secondary" align="center">
                {english}
              </Text>
            ) : null}
          </View>
        ) : null}

        {chars.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: 4 }}
          >
            {chars.map((c, i) => {
              const active = i === idx;
              return (
                <Pressable
                  key={`${c}-${i}`}
                  onPress={() => setIdx(i)}
                  accessibilityLabel={`Show ${c}`}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: theme.radii.md,
                    borderWidth: 2,
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                    backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text chinese variant="h3" color={active ? "accent" : "primary"}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <StrokeAnimator key={current} hanzi={current} size={260} />
      </View>
    </Modal>
  );
}
