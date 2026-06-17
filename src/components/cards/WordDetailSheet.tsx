import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { Check, FlipHorizontal2, PenLine, Play, RotateCcw, Trash2, Volume2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, View } from "react-native";

import { Modal, Text } from "@/components/ui";
import { SaveToDeckSheet } from "@/components/cards/SaveToDeckSheet";
import { StrokeAnimator } from "@/components/StrokeAnimator";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

export type WordDetail = {
  hanzi: string;
  pinyin: string;
  english: string;
  /** Optional extra meanings shown as a numbered list. */
  meanings?: string[];
  hskLevel?: number | null;
  /** Sentence the user originally saw the word in (when saved from the ext). */
  contextSentence?: string | null;
  /** Optional pinyin for the context sentence (renders under it in mono). */
  contextPinyin?: string | null;
  /** Optional translation of the context sentence into the user's language. */
  contextTranslation?: string | null;
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
  /** Whether the word is already in the deck — controls "in deck" badge. */
  isSaved?: boolean;
};

// Mirror of HSK_PILL in browse.tsx — kept duplicated so this component
// doesn't take a dependency on the screen module.
const HSK_PILL: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#FCE4E6", fg: "#C8102E" },
  2: { bg: "#FEEDD3", fg: "#A85B00" },
  3: { bg: "#FBF3DF", fg: "#8A6A1A" },
  4: { bg: "#FFE6CC", fg: "#A85B00" },
  5: { bg: "#DCEEDB", fg: "#1F8A5B" },
  6: { bg: "#E0EAFF", fg: "#3B6FE0" },
};

// Brand tone-3 purple — matches the design system's `--t3` variable
// used for the giant hanzi in the word-detail mockup.
const PURPLE_HANZI = "#6A4C9C";

/**
 * Word detail bottom sheet — full redesign per the v13c mockup.
 *
 * Layout from top to bottom:
 *   1. Badge row (HSK pill, POS, IN-DECK if saved)
 *   2. Huge hanzi centered, optionally flipped to reveal the meaning
 *   3. Pinyin in monospace
 *   4. Two action pills: "Speak" (light red) and "Flip" (light grey)
 *   5. Numbered meanings list
 *   6. Optional context card (pink) — sentence + pinyin + translation
 *   7. Bottom bar: small "Delete" text button + big "Practice now" CTA
 */
export function WordDetailSheet({ visible, onClose, word, onSave, onDelete, isSaved }: Props) {
  const theme = useTheme();
  const t = useT();
  const [flipped, setFlipped] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [strokesOpen, setStrokesOpen] = useState(false);

  // Auto-play TTS on open. Stop when sheet closes.
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
  const hsk = word.hskLevel ?? 0;
  const hskTone = HSK_PILL[hsk] ?? null;

  return (
    <Modal visible={visible} onClose={onClose} presentation="sheet">
      <ScrollView
        // The Modal wrapper uses flexShrink:1 with no intrinsic height, so a
        // nested flex-column splits as zero. Run the ScrollView directly as
        // the content; bottom-action bar follows as the last item in the
        // scroll instead of a sticky footer. For a typical word the whole
        // sheet fits on screen and nothing actually scrolls.
        contentContainerStyle={{
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
          gap: theme.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
          {/* Top badge row */}
          <View
            style={{
              flexDirection: "row",
              gap: theme.spacing.xs,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {hsk > 0 && hskTone ? (
              <DetailBadge
                text={fmt(t.vocab.browse.hskBadge, { n: hsk })}
                bg={hskTone.bg}
                fg={hskTone.fg}
              />
            ) : null}
            {word.posLabel ? (
              <DetailBadge
                text={word.posLabel.toUpperCase()}
                bg={theme.colors.surfaceHover}
                fg={theme.colors.textSecondary}
              />
            ) : null}
            {isSaved ? (
              <DetailBadge text={`✓ ${t.vocab.browse.inDeckBadge}`} bg="#DCEEDB" fg="#1F8A5B" />
            ) : null}
          </View>

          {/* Hanzi flip area */}
          <FlipHanzi
            hanzi={word.hanzi}
            meaning={meanings[0] ?? ""}
            flipped={flipped}
            onFlip={flip}
          />

          {/* Pinyin — JetBrains Mono per the brand spec, makes tone marks
              line up vertically and gives the latin block its own rhythm. */}
          <Text
            align="center"
            style={{
              color: theme.colors.textSecondary,
              fontSize: 22,
              lineHeight: 28,
              fontFamily: theme.fonts.pinyinMono,
              letterSpacing: 0.5,
            }}
          >
            {word.pinyin}
          </Text>

          {/* Action pills — speak, flip, strokes */}
          <View
            style={{
              flexDirection: "row",
              gap: theme.spacing.sm,
              justifyContent: "center",
              paddingHorizontal: theme.spacing.lg,
              flexWrap: "wrap",
            }}
          >
            <ActionPill
              icon={<Volume2 color="#C8102E" size={18} strokeWidth={2.2} />}
              label={t.vocab.browse.detailSpeak}
              bg="#FCE4E6"
              fg="#C8102E"
              onPress={speak}
            />
            <ActionPill
              icon={<FlipHorizontal2 color={theme.colors.textPrimary} size={18} strokeWidth={2.2} />}
              label={t.vocab.browse.detailFlip}
              bg={theme.colors.surfaceHover}
              fg={theme.colors.textPrimary}
              onPress={flip}
            />
            <ActionPill
              icon={<PenLine color="#7A1C1C" size={18} strokeWidth={2.2} />}
              label={t.vocab.browse.detailStrokes}
              bg="#F5E6CC"
              fg="#7A1C1C"
              onPress={() => setStrokesOpen(true)}
            />
          </View>

          {/* Numbered meanings */}
          {meanings.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="caption" color="tertiary" style={{ letterSpacing: 1.2 }}>
                {t.vocab.browse.detailMeaningsTitle}
              </Text>
              <View style={{ gap: theme.spacing.sm }}>
                {meanings.map((m, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      gap: theme.spacing.sm,
                      alignItems: "flex-start",
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      // Warm beige fill (design --bg-warm #F5F1EA) — gives the
                      // numbered list a subtle separation from the white-paper
                      // sheet body without a heavy border.
                      backgroundColor: theme.colors.surfaceHover,
                      borderRadius: theme.radii.md,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.textTertiary,
                        fontSize: 14,
                        lineHeight: 20,
                        fontWeight: "700",
                        minWidth: 18,
                      }}
                    >
                      {i + 1}.
                    </Text>
                    <Text variant="body" style={{ flex: 1 }}>
                      {m}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Context block */}
          {word.contextSentence ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="caption" color="tertiary" style={{ letterSpacing: 1.2 }}>
                {t.vocab.browse.detailContextTitle}
              </Text>
              <View
                style={{
                  padding: theme.spacing.md,
                  borderRadius: theme.radii.md,
                  backgroundColor: "#FFE2E4",
                  borderLeftWidth: 3,
                  borderLeftColor: "#C8102E",
                  gap: 6,
                }}
              >
                <Text chinese variant="body" style={{ fontWeight: "600" }}>
                  {highlightHanzi(word.contextSentence, word.hanzi)}
                </Text>
                {word.contextPinyin ? (
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: 13,
                      lineHeight: 18,
                      fontFamily: theme.fonts.pinyinMono,
                    }}
                  >
                    {word.contextPinyin}
                  </Text>
                ) : null}
                {word.contextTranslation ? (
                  <Text
                    style={{
                      color: theme.colors.textTertiary,
                      fontSize: 12,
                      lineHeight: 16,
                      fontStyle: "italic",
                    }}
                  >
                    «{word.contextTranslation}»
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

        {/* Bottom action row — last child of the ScrollView so it follows
            the content naturally. Sticky-footer behaviour needs a parent
            with definite height (the Modal wrapper doesn't give us one). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            paddingTop: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          {onDelete && isSaved ? (
            <Pressable
              onPress={() => {
                onDelete();
                onClose();
              }}
              hitSlop={10}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            >
              <Trash2 color={theme.colors.textTertiary} size={16} strokeWidth={2.2} />
              <Text variant="small" color="tertiary" style={{ fontWeight: "600" }}>
                {t.vocab.browse.detailDelete}
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          {onSave || isSaved ? (
            <Pressable
              onPress={() => setSaveSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t.vocab.browse.detailToDeckBtn}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: theme.radii.full,
                backgroundColor: isSaved
                  ? theme.colors.surface
                  : theme.colors.accent,
                borderWidth: isSaved ? 1 : 0,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.92 : 1,
                ...(isSaved
                  ? {}
                  : {
                      ...theme.shadows.sm,
                      shadowColor: theme.colors.accent,
                      shadowOpacity: 0.25,
                    }),
                marginRight: isSaved ? 8 : 0,
              })}
            >
              <Check
                color={isSaved ? theme.colors.textPrimary : "#FFFFFF"}
                size={16}
                strokeWidth={2.4}
              />
              <Text
                style={{
                  color: isSaved ? theme.colors.textPrimary : "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {isSaved ? t.vocab.browse.detailDecksBtn : t.vocab.browse.detailToDeckBtn}
              </Text>
            </Pressable>
          ) : null}
          {!onSave || isSaved ? (
            <Pressable
              onPress={() => {
                onClose();
                // Send the user into a single-word review so "Тренировать
                // сейчас" actually drills THIS word, not whatever's due in
                // the deck. Review screen looks for `hanzi` param and
                // fetches just that card from saved_words.
                setTimeout(
                  () =>
                    router.push({
                      pathname: "/(app)/vocab/review",
                      params: { hanzi: word.hanzi },
                    }),
                  220,
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={t.vocab.browse.detailPracticeNow}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: theme.radii.full,
                backgroundColor: "#1A1614",
                opacity: pressed ? 0.92 : 1,
                ...theme.shadows.sm,
                shadowOpacity: 0.18,
              })}
            >
              <Play color="#FFFFFF" size={16} strokeWidth={2.4} fill="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
                {t.vocab.browse.detailPracticeNow}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Deck picker — opened from the "В колоду / Колоды" bottom button.
          `onFirstAdd` ensures the saved_words row exists before the first
          deck-membership write. Only fires for unsaved words; already-saved
          words don't need the upsert (and calling addWord on them would
          reset SRS state). */}
      <SaveToDeckSheet
        visible={saveSheetOpen}
        onClose={() => setSaveSheetOpen(false)}
        hanzi={word.hanzi}
        pinyin={word.pinyin}
        onFirstAdd={!isSaved && onSave ? () => onSave() : undefined}
      />

      {/* Stroke-order animation — supports multi-character words via the
          chip selector at top. Each tap restarts the StrokeAnimator with
          the picked character. Same component the Characters section uses. */}
      <StrokeOrderSheet
        visible={strokesOpen}
        onClose={() => setStrokesOpen(false)}
        word={word.hanzi}
        pinyin={word.pinyin}
      />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FlipHanzi — huge centered character that flips to reveal the meaning on
// the back. Same 3D rotateY trick as before but the FRONT shows ONLY the
// hanzi (purple, ~96 pt) — pinyin and audio button now live below the
// card so they stay visible when flipped to the back.
// ────────────────────────────────────────────────────────────────────────────
function FlipHanzi({
  hanzi,
  meaning,
  flipped,
  onFlip,
}: {
  hanzi: string;
  meaning: string;
  flipped: boolean;
  onFlip: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const rotation = useRef(new Animated.Value(0)).current;
  // Measure the card's actual paint width so we can shrink the hanzi font
  // for long words (4+ characters like 一丝不苟) instead of wrapping to a
  // second line — wrapping breaks the centred-poster aesthetic.
  const [cardW, setCardW] = useState(0);

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
    opacity: rotation.interpolate({
      inputRange: [0, 0.5, 0.51, 1],
      outputRange: [1, 1, 0, 0],
    }),
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
    opacity: rotation.interpolate({
      inputRange: [0, 0.49, 0.5, 1],
      outputRange: [0, 0, 1, 1],
    }),
  };
  const cardHPad = theme.spacing.lg;
  const cardStyle = {
    width: "100%" as const,
    minHeight: 140,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: cardHPad,
  };

  // Compute a hanzi font size that fits the available card width on one
  // line. CJK glyphs are roughly square, but advance width creeps slightly
  // past the em — 1.02 leaves a hair of breathing room so the last char
  // never gets pushed off. Falls back to the 96pt poster size for short
  // words (1–2 chars), shrinks down to ~32pt for very long phrases.
  const charCount = Math.max(1, [...hanzi].length);
  const MAX_FONT = 96;
  const MIN_FONT = 32;
  const availW = Math.max(0, cardW - cardHPad * 2);
  const fittingFont =
    availW > 0
      ? Math.max(
          MIN_FONT,
          Math.min(MAX_FONT, Math.floor(availW / (charCount * 1.02))),
        )
      : MAX_FONT;

  return (
    <Pressable onPress={onFlip} accessibilityLabel={t.wordDetail.flipHint}>
      <View
        style={{ width: "100%", minHeight: 140 }}
        onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            cardStyle,
            frontStyle,
            { position: "absolute", top: 0, left: 0, right: 0, backfaceVisibility: "hidden" },
          ]}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontSize: fittingFont,
              lineHeight: fittingFont * 1.15,
              fontFamily: theme.fonts.chineseSerif,
              color: PURPLE_HANZI,
            }}
          >
            {hanzi}
          </Text>
        </Animated.View>
        <Animated.View style={[cardStyle, backStyle, { backfaceVisibility: "hidden" }]}>
          <Text
            variant="h2"
            align="center"
            style={{ color: theme.colors.accent, fontSize: 24, lineHeight: 30, fontWeight: "700" }}
          >
            {meaning}
          </Text>
          <Text variant="caption" color="tertiary" style={{ marginTop: 6 }}>
            {t.wordDetail.tapToFlipBack}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function ActionPill({
  icon,
  label,
  bg,
  fg,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 22,
        backgroundColor: bg,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <Text style={{ color: fg, fontSize: 14, lineHeight: 18, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function DetailBadge({
  text,
  bg,
  fg,
}: {
  text: string;
  bg: string;
  fg: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 11,
          lineHeight: 14,
          fontFamily: theme.fonts.uiBold,
          letterSpacing: 0.4,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * Wrap occurrences of `target` inside the sentence with accent styling so
 * the reader can scan to the saved word at a glance.
 */
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

// ────────────────────────────────────────────────────────────────────────────
// StrokeOrderSheet — modal that animates stroke order for the word. Splits
// the word into individual CJK characters so a multi-char word like 你好
// gets a chip selector at the top; tapping a chip re-mounts StrokeAnimator
// with the picked character (key change triggers the autoplay loop again).
// ────────────────────────────────────────────────────────────────────────────
const CJK_RE = /[一-鿿]/;

function StrokeOrderSheet({
  visible,
  onClose,
  word,
  pinyin,
}: {
  visible: boolean;
  onClose: () => void;
  word: string;
  pinyin: string;
}) {
  const theme = useTheme();
  const t = useT();
  const chars = [...word].filter((c) => CJK_RE.test(c));
  const [idx, setIdx] = useState(0);
  // Bumps to restart the animator without changing the hanzi prop — used
  // by the "Повторить" button so the user can re-watch the same character.
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    // Reset to the first char each time the sheet opens — otherwise the
    // selector lingers on whatever was active in the previous word.
    if (visible) {
      setIdx(0);
      setReplayKey(0);
    }
  }, [visible, word]);

  const current = chars[idx] ?? word;

  return (
    <Modal visible={visible} onClose={onClose} presentation="sheet">
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: "#E63946",
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 1.4,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.browse.strokeOrderLabel}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text
              chinese
              style={{
                color: theme.colors.textPrimary,
                fontSize: 22,
                lineHeight: 26,
                fontFamily: theme.fonts.uiBold,
              }}
              numberOfLines={1}
            >
              {word}
            </Text>
            <Text
              style={{
                color: theme.colors.textTertiary,
                fontSize: 13,
                fontFamily: theme.fonts.pinyinMono,
              }}
            >
              {pinyin}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel={t.common.close}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.colors.surfaceHover,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>×</Text>
        </Pressable>
      </View>

      {/* Character selector — only shown for multi-char words */}
      {chars.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
        >
          {chars.map((c, i) => {
            const active = i === idx;
            return (
              <Pressable
                key={`${c}-${i}`}
                onPress={() => {
                  setIdx(i);
                  setReplayKey((k) => k + 1);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                  borderWidth: active ? 0 : 1,
                  borderColor: theme.colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  chinese
                  style={{
                    color: active ? theme.colors.onAccent : theme.colors.textPrimary,
                    fontSize: 28,
                    lineHeight: 32,
                    fontFamily: theme.fonts.chineseSerifBlack,
                  }}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: theme.spacing.md,
        }}
      >
        {/* The key bump on `replayKey` forces a remount → StrokeAnimator
            autoplays again. Same trick used in the character writing step. */}
        <StrokeAnimator
          key={`${current}-${replayKey}`}
          hanzi={current}
          size={260}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={() => setReplayKey((k) => k + 1)}
          accessibilityRole="button"
          accessibilityLabel={t.vocab.browse.replay}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <RotateCcw color={theme.colors.textPrimary} size={16} strokeWidth={2.4} />
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: 15,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {t.vocab.browse.replay}
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: theme.colors.textPrimary,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.common.done}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
