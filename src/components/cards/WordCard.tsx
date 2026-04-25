import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Volume2 } from "lucide-react-native";
import { type ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";

import { Text } from "@/components/ui";
import { PinyinText } from "@/components/cards/PinyinText";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/theme";

type Props = {
  hanzi: string;
  pinyin: string;
  english?: string;
  /** Tap handler for the row body. Usually opens a WordDetailSheet. */
  onPress?: () => void;
  /** Slot for trailing action buttons (save / delete / etc). */
  trailing?: ReactNode;
  /** Inline pills/badges rendered below the meaning line. */
  badges?: ReactNode;
  /** Hide the audio button (e.g. on truly minimal recap rows). */
  hideAudio?: boolean;
  /** Larger hanzi when the row should feel more like a study card than a list item. */
  emphasizeHanzi?: boolean;
  style?: ViewStyle;
};

/**
 * The canonical "word in a list" card. Used by the deck, HSK levels, topics,
 * the home recent-words section, and anywhere else a single saved/HSK word
 * shows up. Audio button + tone-colored pinyin are the core upgrade over the
 * old inline rows; tapping the body delegates to whatever the parent wants
 * (typically opening WordDetailSheet).
 */
export function WordCard({
  hanzi,
  pinyin,
  english,
  onPress,
  trailing,
  badges,
  hideAudio,
  emphasizeHanzi,
  style,
}: Props) {
  const theme = useTheme();
  const t = useT();

  function speak() {
    Haptics.selectionAsync().catch(() => {});
    Speech.stop().catch(() => {});
    Speech.speak(hanzi, { language: "zh-CN", rate: 0.9 });
  }

  const Container: React.ElementType = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      android_ripple={onPress ? { color: theme.colors.surfaceHover } : undefined}
      accessibilityLabel={onPress ? hanzi : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...style,
      }}
    >
      <Text
        chinese
        variant={emphasizeHanzi ? "h1" : "h2"}
        // Touch target is the entire row — no separate Pressable on hanzi to
        // avoid swallowing the parent's tap.
      >
        {hanzi}
      </Text>

      <View style={{ flex: 1, gap: 2 }}>
        <PinyinText pinyin={pinyin} variant="small" />
        {english ? (
          <Text variant="body" numberOfLines={1}>
            {english}
          </Text>
        ) : (
          <Text variant="body" color="tertiary">
            …
          </Text>
        )}
        {badges ? (
          <View style={{ flexDirection: "row", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
            {badges}
          </View>
        ) : null}
      </View>

      {!hideAudio ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            speak();
          }}
          hitSlop={10}
          accessibilityLabel={t.wordDetail.playAudio}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.accentMuted,
          }}
        >
          <Volume2 color={theme.colors.accent} size={18} strokeWidth={2} />
        </Pressable>
      ) : null}

      {trailing ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{trailing}</View> : null}
    </Container>
  );
}
