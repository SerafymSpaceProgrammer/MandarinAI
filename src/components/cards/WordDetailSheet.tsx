import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { BookmarkCheck, BookmarkPlus, PenTool, RotateCcw, Trash2, Volume2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, View } from "react-native";

import { Button, Modal, Text } from "@/components/ui";
import { StrokeViewerModal } from "@/components/StrokeViewerModal";
import { PinyinText } from "@/components/cards/PinyinText";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

export type WordDetail = {
  hanzi: string;
  pinyin: string;
  english: string;
  /** Optional extra meanings shown as a bulleted list on the back. */
  meanings?: string[];
  hskLevel?: number | null;
  /** Sentence the user originally saw the word in (when saved from the ext). */
  contextSentence?: string | null;
  /** POS tag like "noun" / "verb"; rendered as a tertiary badge. */
  posLabel?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  word: WordDetail | null;
  /** Toggle saved/unsaved. When omitted the save button is hidden. */
  onSave?: () => void;
  onDelete?: () => void;
  /** Whether the word is already in the deck — controls save icon state. */
  isSaved?: boolean;
};

/**
 * Bottom sheet that shows everything about a word: hanzi, tone-colored
 * pinyin, audio playback, meanings, context, HSK badge, stroke viewer.
 * The whole upper half flips with a card animation between the meaning
 * front and the hanzi back so users can self-quiz from the same screen.
 */
export function WordDetailSheet({ visible, onClose, word, onSave, onDelete, isSaved }: Props) {
  const theme = useTheme();
  const t = useT();
  const [showStrokes, setShowStrokes] = useState(false);
  const [flipped, setFlipped] = useState(false);

  // Auto-play TTS once on open. Stop when the sheet closes so the audio
  // doesn't keep talking after the user has moved on.
  useEffect(() => {
    if (!visible || !word) return;
    setFlipped(false);
    const id = setTimeout(() => {
      Speech.speak(word.hanzi, { language: "zh-CN", rate: 0.9 });
    }, 220);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
  }, [visible, word]);

  if (!word) return null;

  function speak() {
    if (!word) return;
    Haptics.selectionAsync().catch(() => {});
    Speech.stop().catch(() => {});
    Speech.speak(word.hanzi, { language: "zh-CN", rate: 0.9 });
  }

  function flip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFlipped((f) => !f);
  }

  const meanings =
    word.meanings && word.meanings.length > 0
      ? word.meanings
      : word.english
        ? [word.english]
        : [];

  return (
    <Modal visible={visible} onClose={onClose} presentation="sheet">
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <FlipCard flipped={flipped} onFlip={flip} word={word} onSpeak={speak} />

        {/* Badges row */}
        <View style={{ flexDirection: "row", gap: theme.spacing.xs, justifyContent: "center", flexWrap: "wrap" }}>
          {word.hskLevel != null && word.hskLevel > 0 ? (
            <Pill text={fmt(t.vocab.browse.hskBadge, { n: word.hskLevel })} tone="accent" />
          ) : null}
          {word.posLabel ? <Pill text={word.posLabel} tone="neutral" /> : null}
        </View>

        {/* Meanings list */}
        {meanings.length > 0 ? (
          <View
            style={{
              padding: theme.spacing.lg,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              gap: theme.spacing.xs,
            }}
          >
            <Text variant="caption" color="tertiary">
              {t.wordDetail.meanings}
            </Text>
            {meanings.map((m, i) => (
              <Text key={i} variant="body">
                · {m}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Context sentence */}
        {word.contextSentence ? (
          <View
            style={{
              padding: theme.spacing.lg,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.accentMuted,
              gap: theme.spacing.xs,
            }}
          >
            <Text variant="caption" color="accent">
              {t.wordDetail.context}
            </Text>
            <Text chinese variant="body">
              {highlightHanzi(word.contextSentence, word.hanzi)}
            </Text>
          </View>
        ) : null}

        {/* Action row */}
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <Button
            label={t.strokes.title}
            variant="secondary"
            size="md"
            fullWidth
            style={{ flex: 1 }}
            leftIcon={<PenTool color={theme.colors.accent} size={18} strokeWidth={2} />}
            onPress={() => setShowStrokes(true)}
          />
          <Button
            label={t.wordDetail.practiceWriting}
            variant="secondary"
            size="md"
            fullWidth
            style={{ flex: 1 }}
            onPress={() => {
              onClose();
              setTimeout(() => {
                router.push("/(app)/practice/writing-session?source=deck");
              }, 250);
            }}
          />
        </View>

        {(onSave || onDelete) ? (
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            {onSave ? (
              <Button
                label={isSaved ? t.wordDetail.saved : t.common.save}
                variant={isSaved ? "ghost" : "primary"}
                size="md"
                fullWidth
                style={{ flex: 1 }}
                leftIcon={
                  isSaved ? (
                    <BookmarkCheck color={theme.colors.success} size={18} strokeWidth={2} />
                  ) : (
                    <BookmarkPlus color={theme.colors.onAccent} size={18} strokeWidth={2} />
                  )
                }
                onPress={() => {
                  if (!isSaved) onSave();
                }}
                disabled={isSaved}
              />
            ) : null}
            {onDelete ? (
              <Button
                label={t.wordDetail.remove}
                variant="ghost"
                size="md"
                fullWidth
                style={{ flex: 1 }}
                leftIcon={<Trash2 color={theme.colors.danger} size={18} strokeWidth={2} />}
                onPress={() => {
                  onDelete();
                  onClose();
                }}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <StrokeViewerModal
        visible={showStrokes}
        onClose={() => setShowStrokes(false)}
        hanzi={word.hanzi}
        pinyin={word.pinyin}
        english={word.english}
      />
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Flip card — front shows hanzi + pinyin + audio; back hides hanzi for self-
// quiz mode. RN's interpolations on rotateY produce a smooth 3D flip without
// any extra deps.
// ──────────────────────────────────────────────────────────────────────────
function FlipCard({
  flipped,
  onFlip,
  word,
  onSpeak,
}: {
  flipped: boolean;
  onFlip: () => void;
  word: WordDetail;
  onSpeak: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(rotation, {
      toValue: flipped ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [flipped, rotation]);

  const frontStyle = {
    transform: [
      {
        rotateY: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
    opacity: rotation.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [1, 1, 0, 0] }),
  };
  const backStyle = {
    transform: [
      {
        rotateY: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ["180deg", "360deg"],
        }),
      },
    ],
    opacity: rotation.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] }),
  };

  const cardStyle = {
    width: "100%" as const,
    minHeight: 200,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  };

  return (
    <Pressable onPress={onFlip} accessibilityLabel={t.wordDetail.flipHint}>
      <View style={{ width: "100%", minHeight: 200 }}>
        <Animated.View
          style={[
            cardStyle,
            frontStyle,
            { position: "absolute", top: 0, left: 0, right: 0, backfaceVisibility: "hidden" },
          ]}
        >
          <Text chinese style={{ fontSize: 80, lineHeight: 90, fontWeight: "700", color: theme.colors.textPrimary }}>
            {word.hanzi}
          </Text>
          <PinyinText pinyin={word.pinyin} variant="h3" />
          <SpeakButton onPress={onSpeak} />
          <Text variant="caption" color="tertiary">
            {t.wordDetail.flipHint}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            cardStyle,
            backStyle,
            { backgroundColor: theme.colors.accentMuted, backfaceVisibility: "hidden" },
          ]}
        >
          <RotateCcw color={theme.colors.accent} size={28} strokeWidth={2} />
          <Text variant="h2" align="center" color="accent">
            {word.english}
          </Text>
          <Text variant="caption" color="tertiary">
            {t.wordDetail.tapToFlipBack}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function SpeakButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      hitSlop={12}
      accessibilityLabel="Play audio"
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Volume2 color={theme.colors.accent} size={22} strokeWidth={2.2} />
    </Pressable>
  );
}

function Pill({ text, tone }: { text: string; tone: "accent" | "neutral" }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 10,
        borderRadius: theme.radii.full,
        backgroundColor: tone === "accent" ? theme.colors.accentMuted : theme.colors.surfaceHover,
      }}
    >
      <Text variant="small" color={tone === "accent" ? "accent" : "tertiary"}>
        {text}
      </Text>
    </View>
  );
}

// Wrap occurrences of `target` inside the sentence with bracket markers so
// readers can scan to the relevant span quickly. Returns an array of Text
// children where matched spans are styled as accents.
function highlightHanzi(sentence: string, target: string): React.ReactNode {
  if (!target) return sentence;
  const parts = sentence.split(target);
  if (parts.length === 1) return sentence;
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (p) out.push(p);
    if (i < parts.length - 1) {
      out.push(
        <Text key={`hl-${i}`} chinese color="accent" variant="bodyStrong">
          {target}
        </Text>,
      );
    }
  });
  return out;
}
