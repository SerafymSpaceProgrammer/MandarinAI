import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  RotateCcw,
  Volume2,
  X as XIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import { HanziWithPinyin } from "@/features/grammar/components/HanziWithPinyin";
import {
  ALL_LEXICAL_LEVELS,
  type LexicalLevel,
} from "@/features/grammar/patterns";
import { buildDrill, type DrillSession } from "@/features/listening/drills";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Phase = "listening" | "answered" | "done";

const MAX_REPLAYS = 3;

export default function ListeningSession() {
  const theme = useTheme();
  const t = useT();
  const params = useLocalSearchParams<{ level?: string }>();
  const nativeLang = useUserStore((s) => s.profile?.native_language ?? "en");

  const level = parseLevel(params.level) ?? 1;

  // Build the drill once per (level, lang) — re-rolling on every render would
  // shuffle questions away from the user mid-session.
  const drill = useMemo<DrillSession>(
    () => buildDrill(level, nativeLang),
    [level, nativeLang],
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("listening");
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [replays, setReplays] = useState(0);
  const [score, setScore] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  const total = drill.questions.length;
  const question = drill.questions[index];

  const speak = useCallback(
    (countAsReplay: boolean) => {
      if (!question) return;
      Speech.stop().catch(() => {});
      Speech.speak(question.zh, { language: "zh-CN", rate: 0.85 });
      if (countAsReplay) setReplays((r) => r + 1);
    },
    [question],
  );

  // Auto-play the first time we land on a question.
  useEffect(() => {
    if (phase !== "listening" || !question) return;
    const id = setTimeout(() => speak(false), 250);
    return () => clearTimeout(id);
  }, [index, phase, question, speak]);

  // Pause TTS on unmount.
  useEffect(() => {
    return () => {
      Speech.stop().catch(() => {});
    };
  }, []);

  const pick = useCallback(
    (choiceIdx: number) => {
      if (phase !== "listening" || !question) return;
      const correct = choiceIdx === question.answerIndex;
      setPickedIdx(choiceIdx);
      setPhase("answered");
      if (correct) setScore((s) => s + 1);
      Haptics.impactAsync(
        correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
      ).catch(() => {});
    },
    [phase, question],
  );

  const next = useCallback(() => {
    if (index + 1 >= total) {
      setPhase("done");
      return;
    }
    setIndex((i) => i + 1);
    setPickedIdx(null);
    setReplays(0);
    setPhase("listening");
  }, [index, total]);

  const restart = useCallback(() => {
    // Re-seed the drill with a fresh shuffle by bumping the level dep on
    // memo? simpler: navigate to the picker.
    router.replace(`/(app)/practice/listening-session?level=${level}&t=${Date.now()}`);
  }, [level]);

  if (!question) {
    return (
      <Screen padded>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.md,
          }}
        >
          <Text variant="h3">{t.listeningDrill.buildFailed}</Text>
          <Button label={t.common.back} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const elapsedSec = Math.round((Date.now() - startedAtRef.current) / 1000);

  return (
    <Screen padded>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {fmt(t.listeningDrill.sessionEyebrow, { range: level === 1 ? "1" : `1–${level}` })}
          </Text>
          <Text variant="h3">
            {phase === "done" ? t.listeningDrill.sessionDone : `${index + 1} / ${total}`}
          </Text>
        </View>
        <Text variant="bodyStrong" color="accent">
          {score}
        </Text>
      </View>

      <ProgressBar current={phase === "done" ? total : index + 1} total={total} />

      {phase === "done" ? (
        <DoneView
          score={score}
          total={total}
          elapsedSec={elapsedSec}
          onRestart={restart}
          onExit={() => router.back()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing["3xl"],
            gap: theme.spacing.lg,
          }}
        >
          {/* Audio prompt */}
          <Card
            padding="lg"
            bordered
            style={{ alignItems: "center", gap: theme.spacing.md }}
          >
            <Pressable
              onPress={() => speak(phase === "listening")}
              disabled={phase === "listening" && replays >= MAX_REPLAYS}
              accessibilityLabel={t.listeningDrill.playA11y}
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor:
                  phase === "listening" && replays >= MAX_REPLAYS
                    ? theme.colors.surface
                    : theme.colors.accent,
                alignItems: "center",
                justifyContent: "center",
                ...theme.shadows.md,
              }}
            >
              <Volume2
                color={
                  phase === "listening" && replays >= MAX_REPLAYS
                    ? theme.colors.textTertiary
                    : theme.colors.onAccent
                }
                size={48}
                strokeWidth={2}
              />
            </Pressable>
            <Text variant="caption" color="tertiary">
              {phase === "listening"
                ? fmt(t.listeningDrill.replaysLeft, { n: MAX_REPLAYS - replays })
                : t.listeningDrill.replayAgain}
            </Text>
          </Card>

          {/* Reveal block — only after answering */}
          {phase === "answered" ? (
            <RevealedBlock zh={question.zh} py={question.py} />
          ) : null}

          {/* Choices */}
          <View style={{ gap: theme.spacing.sm }}>
            {question.choices.map((choice, idx) => (
              <ChoiceButton
                key={`${index}-${idx}-${choice}`}
                label={choice}
                state={
                  phase === "listening"
                    ? "idle"
                    : idx === question.answerIndex
                      ? "correct"
                      : idx === pickedIdx
                        ? "wrong"
                        : "muted"
                }
                onPress={() => pick(idx)}
              />
            ))}
          </View>

          {phase === "answered" ? (
            <Button
              label={index + 1 >= total ? t.listeningDrill.summary : t.listeningDrill.next}
              variant="primary"
              onPress={next}
              fullWidth
              rightIcon={<ChevronRight color={theme.colors.onAccent} size={20} strokeWidth={2.4} />}
            />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Choice button
// ──────────────────────────────────────────────────────────────────────────

type ChoiceState = "idle" | "correct" | "wrong" | "muted";

function ChoiceButton({
  label,
  state,
  onPress,
}: {
  label: string;
  state: ChoiceState;
  onPress: () => void;
}) {
  const theme = useTheme();

  const palette: Record<
    ChoiceState,
    { bg: string; border: string; text: "primary" | "onAccent" | "secondary"; icon: React.ReactNode | null }
  > = {
    idle: {
      bg: theme.colors.surface,
      border: theme.colors.border,
      text: "primary",
      icon: null,
    },
    correct: {
      bg: theme.colors.success,
      border: theme.colors.success,
      text: "onAccent",
      icon: <Check color={theme.colors.onAccent} size={18} strokeWidth={2.4} />,
    },
    wrong: {
      bg: theme.colors.danger,
      border: theme.colors.danger,
      text: "onAccent",
      icon: <XIcon color={theme.colors.onAccent} size={18} strokeWidth={2.4} />,
    },
    muted: {
      bg: theme.colors.surface,
      border: theme.colors.border,
      text: "secondary",
      icon: null,
    },
  };
  const s = palette[state];

  return (
    <Pressable
      onPress={onPress}
      disabled={state !== "idle"}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: s.bg,
        borderWidth: 1,
        borderColor: s.border,
        opacity: state === "muted" ? 0.5 : 1,
      }}
    >
      <Text variant="body" color={s.text} style={{ flex: 1 }}>
        {label}
      </Text>
      {s.icon}
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Reveal — fades in the hanzi + pinyin once the user has answered
// ──────────────────────────────────────────────────────────────────────────

function RevealedBlock({ zh, py }: { zh: string; py: string }) {
  const theme = useTheme();
  const t = useT();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [zh, opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Card
        padding="lg"
        bordered
        style={{ borderColor: theme.colors.accent, gap: theme.spacing.sm }}
      >
        <Text variant="caption" color="accent">
          {t.listeningDrill.youHeard}
        </Text>
        <View style={{ paddingVertical: theme.spacing.sm }}>
          <HanziWithPinyin hanzi={zh} fallbackPinyin={py} hanziSize={28} />
        </View>
      </Card>
    </Animated.View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Done view
// ──────────────────────────────────────────────────────────────────────────

function DoneView({
  score,
  total,
  elapsedSec,
  onRestart,
  onExit,
}: {
  score: number;
  total: number;
  elapsedSec: number;
  onRestart: () => void;
  onExit: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const message =
    pct === 100
      ? t.listeningDrill.doneMsgPerfect
      : pct >= 80
        ? t.listeningDrill.doneMsgGreat
        : pct >= 50
          ? t.listeningDrill.doneMsgKeep
          : t.listeningDrill.doneMsgEasier;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        gap: theme.spacing["2xl"],
        paddingVertical: theme.spacing["3xl"],
      }}
    >
      <View style={{ alignItems: "center", gap: theme.spacing.md }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: theme.colors.accentMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="display" color="accent">
            {pct}%
          </Text>
        </View>
        <Text variant="h2" align="center">
          {score} / {total}
        </Text>
        <Text variant="body" color="secondary" align="center">
          {message}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <Stat label={t.listeningDrill.statTime} value={formatSeconds(elapsedSec, t)} />
        <Stat
          label={t.listeningDrill.statPerPhrase}
          value={
            total > 0
              ? fmt(t.listeningDrill.statSeconds, { n: Math.round((elapsedSec / total) * 10) / 10 })
              : "—"
          }
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t.listeningDrill.oneMoreSession}
          variant="primary"
          onPress={onRestart}
          fullWidth
          leftIcon={
            <RotateCcw color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
          }
        />
        <Button label={t.listeningDrill.backToPractice} variant="secondary" onPress={onExit} fullWidth />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 4,
      }}
    >
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text variant="h3">{value}</Text>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Misc
// ──────────────────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const theme = useTheme();
  const pct = total > 0 ? Math.min(1, current / total) : 0;
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.surface,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          backgroundColor: theme.colors.accent,
        }}
      />
    </View>
  );
}

function parseLevel(raw: string | undefined): LexicalLevel | null {
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  return ALL_LEXICAL_LEVELS.find((l) => l === n) ?? null;
}

function formatSeconds(s: number, t: Translations): string {
  if (s < 60) return fmt(t.listeningDrill.secondsShort, { n: s });
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0
    ? fmt(t.listeningDrill.minutesShort, { n: m })
    : fmt(t.listeningDrill.minutesSeconds, { m, s: r });
}
