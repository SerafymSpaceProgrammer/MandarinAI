import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { ActivityIndicator, Animated, Easing, Pressable, View } from "react-native";
import { Mic, RotateCcw, Volume2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";

import { Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import {
  cancelActiveRecording,
  ensureMicPermission,
  startRecording,
} from "@/features/speaking/recorder";
import type { TonePronounceQuestion } from "@/features/exercises/types";
import {
  scoreToneFromAudio,
  type ToneScore,
} from "@/features/tones/onDeviceToneScorer";
import { useTheme } from "@/theme";

type Props = {
  question: TonePronounceQuestion;
  onResult: (correct: boolean) => void;
};

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; stopFn: () => Promise<{ uri: string; mimeType: string } | null> }
  | { kind: "scoring" }
  | { kind: "scored"; score: ToneScore };

const TONE_GLYPHS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "ā",
  2: "á",
  3: "ǎ",
  4: "à",
  5: "a",
};

const TONE_LABEL_KEYS: Record<
  1 | 2 | 3 | 4 | 5,
  "tone1" | "tone2" | "tone3" | "tone4" | "toneNeutral"
> = {
  1: "tone1",
  2: "tone2",
  3: "tone3",
  4: "tone4",
  5: "toneNeutral",
};

/**
 * "Speak the tone" exercise card. The user sees a single hanzi with its
 * expected tone, plays the reference TTS, then taps the mic to record
 * themselves. The on-device tone scorer evaluates the pitch contour and
 * reports back which tone it heard. No OpenAI roundtrip — works offline
 * after the recording is captured.
 */
export function TonePronounceCard({ question, onResult }: Props) {
  const theme = useTheme();
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const expected = question.tone;

  // Pulse animation while recording, matches the speaking-session mic UI
  // for visual continuity.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase.kind !== "recording") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase.kind, pulse]);

  // Auto-play the reference TTS once when the card mounts so the user
  // hears the target before recording. Stop it on unmount.
  useEffect(() => {
    Speech.stop().catch(() => {});
    const id = setTimeout(() => {
      Speech.speak(question.word.hanzi, { language: "zh-CN", rate: 0.85 });
    }, 250);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
      // If user navigates away mid-recording, drop the audio session.
      void cancelActiveRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.word.hanzi]);

  function replayReference() {
    Speech.stop().catch(() => {});
    Speech.speak(question.word.hanzi, { language: "zh-CN", rate: 0.85 });
  }

  async function startRec() {
    const granted = await ensureMicPermission();
    if (!granted) return;
    const handle = await startRecording();
    setPhase({ kind: "recording", stopFn: handle.stop });
  }

  async function stopRec() {
    if (phase.kind !== "recording") return;
    setPhase({ kind: "scoring" });
    const file = await phase.stopFn();
    if (!file) {
      setPhase({ kind: "idle" });
      return;
    }
    const score = await scoreToneFromAudio(file.uri, expected);
    if (!score) {
      setPhase({ kind: "idle" });
      return;
    }
    Haptics.impactAsync(
      score.correct
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPhase({ kind: "scored", score });
  }

  function continueAfterResult(correct: boolean) {
    setPhase({ kind: "idle" });
    onResult(correct);
  }

  const scored = phase.kind === "scored" ? phase.score : null;

  return (
    <View style={{ gap: theme.spacing.xl, alignItems: "center" }}>
      <Text variant="caption" color="tertiary">
        {t.exercises.cards.tonePronounceTitle}
      </Text>

      {/* Reference card — hanzi + pinyin + expected tone glyph */}
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: theme.spacing["2xl"],
          paddingVertical: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          gap: theme.spacing.sm,
        }}
      >
        <Text chinese style={{ fontSize: 72, lineHeight: 80, fontWeight: "700" }}>
          {question.word.hanzi}
        </Text>
        <Text variant="pinyin" color="secondary">
          {question.word.pinyin}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              fontSize: 22,
              lineHeight: 26,
              color: theme.colors.accent,
              fontWeight: "800",
            }}
          >
            {TONE_GLYPHS[expected]}
          </Text>
          <Text variant="small" color="tertiary">
            {fmt(t.exercises.cards.toneOption, {
              n: expected,
              label: t.exercises.cards[TONE_LABEL_KEYS[expected]],
            })}
          </Text>
        </View>
        <Pressable
          onPress={replayReference}
          hitSlop={12}
          accessibilityLabel={t.vocab.review.tapToReplay}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 14,
            backgroundColor: theme.colors.accentMuted,
            marginTop: 6,
          }}
        >
          <Volume2 color={theme.colors.accent} size={16} strokeWidth={2.2} />
          <Text variant="small" color="accent" style={{ fontWeight: "600" }}>
            {t.exercises.cards.tonePronounceReplay}
          </Text>
        </Pressable>
      </View>

      {/* Mic / Stop / Result */}
      {scored ? (
        <ScoreResult
          score={scored}
          expected={expected}
          onRetry={() => setPhase({ kind: "idle" })}
          onNext={() => continueAfterResult(scored.correct)}
        />
      ) : (
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Pressable
              onPress={phase.kind === "recording" ? stopRec : startRec}
              disabled={phase.kind === "scoring"}
              accessibilityRole="button"
              accessibilityLabel={
                phase.kind === "recording"
                  ? t.speaking.tapToStop
                  : t.exercises.cards.tonePronouncePrompt
              }
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor:
                  phase.kind === "recording"
                    ? theme.colors.danger
                    : theme.colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {phase.kind === "scoring" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Mic color="#fff" size={42} strokeWidth={2.2} />
              )}
            </Pressable>
          </Animated.View>
          <Text variant="small" color="tertiary">
            {phase.kind === "recording"
              ? t.speaking.tapToStop
              : phase.kind === "scoring"
                ? t.speaking.scoring
                : t.exercises.cards.tonePronouncePrompt}
          </Text>
        </View>
      )}
    </View>
  );
}

function ScoreResult({
  score,
  expected,
  onRetry,
  onNext,
}: {
  score: ToneScore;
  expected: 1 | 2 | 3 | 4 | 5;
  onRetry: () => void;
  onNext: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const correct = score.correct;
  const heardLabel =
    score.heardTone === 0
      ? t.exercises.cards.tonePronounceUnclear
      : t.exercises.cards[TONE_LABEL_KEYS[score.heardTone]];
  const verdictColor = correct ? theme.colors.success : theme.colors.danger;
  const lowConfidence = score.confidence < 0.35;

  return (
    <View
      style={{
        alignItems: "center",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: verdictColor,
        width: "100%",
      }}
    >
      <Text variant="h2" style={{ color: verdictColor }}>
        {correct
          ? t.exercises.cards.tonePronounceMatch
          : t.exercises.cards.tonePronounceMiss}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <ResultPill
          label={t.exercises.cards.tonePronounceExpected}
          glyph={TONE_GLYPHS[expected]}
          tone={expected}
          theme={theme}
        />
        <Text variant="bodyStrong" color="tertiary">
          →
        </Text>
        <ResultPill
          label={t.exercises.cards.tonePronounceHeard}
          glyph={score.heardTone === 0 ? "?" : TONE_GLYPHS[score.heardTone]}
          tone={score.heardTone}
          theme={theme}
        />
      </View>
      <Text variant="small" color="secondary" align="center">
        {heardLabel}
        {lowConfidence
          ? ` · ${t.exercises.cards.tonePronounceLowConfidence}`
          : ""}
      </Text>

      <View
        style={{
          flexDirection: "row",
          gap: theme.spacing.sm,
          marginTop: theme.spacing.sm,
        }}
      >
        <Pressable
          onPress={onRetry}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.colors.surfaceHover,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <RotateCcw color={theme.colors.textPrimary} size={16} strokeWidth={2.2} />
          <Text variant="small" color="primary" style={{ fontWeight: "600" }}>
            {t.exercises.cards.tonePronounceRetry}
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.colors.accent,
          }}
        >
          <Text variant="small" color="onAccent" style={{ fontWeight: "700" }}>
            {t.exercises.cards.tonePronounceContinue}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultPill({
  label,
  glyph,
  tone,
  theme,
}: {
  label: string;
  glyph: string;
  tone: 0 | 1 | 2 | 3 | 4 | 5;
  theme: ReturnType<typeof useTheme>;
}) {
  const toneColor: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: theme.colors.tone1,
    2: theme.colors.tone2,
    3: theme.colors.tone3,
    4: theme.colors.tone4,
    5: theme.colors.toneNeutral,
  };
  const color = tone === 0 ? theme.colors.textTertiary : toneColor[tone];
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text style={{ fontSize: 32, lineHeight: 36, color, fontWeight: "800" }}>
        {glyph}
      </Text>
    </View>
  );
}
