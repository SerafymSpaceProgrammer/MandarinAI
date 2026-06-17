import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Play,
  RotateCcw,
  Square,
  X as XIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import { recordActivity } from "@/features/activity/activity";
import {
  findStory,
  type ComprehensionQuestion,
  type GradedStory,
} from "@/features/reading/stories";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const MAX_REPLAYS = 3;
const SENTENCE_DELIM = /([。！？!?])/;

type Phase =
  | { kind: "intro" }
  | { kind: "playing"; sentenceIdx: number }
  | { kind: "ready_for_quiz" }
  | { kind: "quiz"; qIdx: number; pickedIdx: number | null; revealed: boolean }
  | { kind: "done" };

type QuizState = {
  questions: PreparedQuestion[];
  picks: Array<number | null>;
};

type PreparedQuestion = {
  q: string;
  correctIdx: number;
  options: string[];
};

export default function ListeningScenarioSession() {
  const theme = useTheme();
  const t = useT();
  const params = useLocalSearchParams<{ id?: string }>();
  const session = useUserStore((s) => s.session);

  const story: GradedStory | null = params.id ? findStory(params.id) : null;

  const sentences = useMemo<string[]>(
    () => (story ? splitIntoSentences(story.bodyZh) : []),
    [story],
  );

  const quizState = useMemo<QuizState | null>(() => {
    if (!story?.comprehension || story.comprehension.length === 0) return null;
    return {
      questions: story.comprehension.map(prepareQuestion),
      picks: story.comprehension.map(() => null),
    };
  }, [story]);

  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [replays, setReplays] = useState(0);
  const [picks, setPicks] = useState<Array<number | null>>(
    quizState ? quizState.picks : [],
  );
  const [startedAt] = useState(() => Date.now());

  // Mic-style pulse on the play button while audio is rolling.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase.kind !== "playing") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase.kind, pulse]);

  // Always tear down TTS when the screen unmounts or the story changes.
  useEffect(() => {
    return () => {
      Speech.stop().catch(() => {});
    };
  }, []);

  const stopPlayback = useCallback(() => {
    Speech.stop().catch(() => {});
    setPhase((cur) => (cur.kind === "playing" ? { kind: "ready_for_quiz" } : cur));
  }, []);

  const playStory = useCallback(() => {
    if (sentences.length === 0) return;
    Speech.stop().catch(() => {});
    setPhase({ kind: "playing", sentenceIdx: 0 });

    let idx = 0;
    const speakNext = () => {
      if (idx >= sentences.length) {
        setPhase({ kind: "ready_for_quiz" });
        return;
      }
      const next = sentences[idx]!;
      // Bump the visible counter before each utterance.
      setPhase({ kind: "playing", sentenceIdx: idx });
      Speech.speak(next, {
        language: "zh-CN",
        rate: 0.85,
        onDone: () => {
          idx += 1;
          // Small breath between sentences — feels more natural.
          setTimeout(speakNext, 120);
        },
        onError: () => {
          idx += 1;
          setTimeout(speakNext, 120);
        },
      });
    };
    speakNext();
  }, [sentences]);

  const replay = useCallback(() => {
    if (replays >= MAX_REPLAYS) return;
    setReplays((r) => r + 1);
    playStory();
  }, [replays, playStory]);

  const startQuiz = useCallback(() => {
    if (!quizState) return;
    setPicks(quizState.questions.map(() => null));
    setPhase({ kind: "quiz", qIdx: 0, pickedIdx: null, revealed: false });
  }, [quizState]);

  const pick = useCallback(
    (choiceIdx: number) => {
      if (phase.kind !== "quiz" || phase.revealed || !quizState) return;
      const q = quizState.questions[phase.qIdx];
      if (!q) return;
      const correct = choiceIdx === q.correctIdx;
      setPhase({ ...phase, pickedIdx: choiceIdx, revealed: true });
      setPicks((prev) => {
        const next = [...prev];
        next[phase.qIdx] = choiceIdx;
        return next;
      });
      Haptics.impactAsync(
        correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
      ).catch(() => {});
    },
    [phase, quizState],
  );

  const advanceQuestion = useCallback(() => {
    if (phase.kind !== "quiz" || !quizState) return;
    const nextIdx = phase.qIdx + 1;
    if (nextIdx >= quizState.questions.length) {
      // Compute score, log activity, flip to done.
      const score = picks.reduce((acc: number, p, i) => {
        const q = quizState.questions[i];
        return acc + (p !== null && q && p === q.correctIdx ? 1 : 0);
      }, 0);
      const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
      const xp = score * 4 + (story?.hskLevel === 3 ? 4 : story?.hskLevel === 2 ? 2 : 0);
      if (session) {
        recordActivity(session.user.id, {
          minutes_studied: minutes,
          exercises_completed: quizState.questions.length,
          xp_earned: Math.max(1, xp),
        });
      }
      setPhase({ kind: "done" });
      return;
    }
    setPhase({ kind: "quiz", qIdx: nextIdx, pickedIdx: null, revealed: false });
  }, [phase, quizState, picks, session, startedAt, story]);

  if (!story || !quizState) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <Text variant="h2">{t.common.error}</Text>
          <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  // ──────────────────────── Done ────────────────────────
  if (phase.kind === "done") {
    const score = picks.reduce((acc: number, p, i) => {
      const q = quizState.questions[i];
      return acc + (p !== null && q && p === q.correctIdx ? 1 : 0);
    }, 0);
    const total = quizState.questions.length;
    const xp = score * 4 + (story.hskLevel === 3 ? 4 : story.hskLevel === 2 ? 2 : 0);
    return (
      <Screen padded>
        <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing["2xl"] }}>
          <View style={{ alignItems: "center", gap: theme.spacing.md }}>
            <Text style={{ fontSize: 72, lineHeight: 80 }}>{story.emoji}</Text>
            <Text variant="h1" align="center">
              {t.listeningScenarios.summaryTitle}
            </Text>
            <Card padding="md" bordered style={{ alignItems: "center" }}>
              <Text variant="body" color="secondary" align="center">
                {fmt(t.listeningScenarios.summaryBody, { score, total, xp: Math.max(1, xp) })}
              </Text>
            </Card>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={t.listeningScenarios.summaryAgain}
              size="lg"
              fullWidth
              onPress={() =>
                router.replace(
                  `/(app)/practice/listening-scenario?id=${encodeURIComponent(story.id)}&t=${Date.now()}`,
                )
              }
            />
            <Button
              label={t.listeningScenarios.summaryPickAnother}
              variant="secondary"
              fullWidth
              onPress={() => router.replace("/(app)/practice/listening-scenarios")}
            />
            <Button
              label={t.listeningScenarios.summaryHome}
              variant="ghost"
              fullWidth
              onPress={() => router.replace("/(app)")}
            />
          </View>
        </View>
      </Screen>
    );
  }

  // ──────────────────────── Quiz ────────────────────────
  if (phase.kind === "quiz") {
    const total = quizState.questions.length;
    const q = quizState.questions[phase.qIdx]!;
    return (
      <Screen padded>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.close}>
            <XIcon color={theme.colors.textSecondary} size={22} strokeWidth={2} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="tertiary">
              {fmt(t.listeningScenarios.quizCounter, { n: phase.qIdx + 1, total })}
            </Text>
            <Text variant="bodyStrong" chinese numberOfLines={1}>
              {story.titleZh}
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View
          style={{
            height: 4,
            backgroundColor: theme.colors.surface,
            borderRadius: 2,
            overflow: "hidden",
            marginBottom: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: `${((phase.qIdx + (phase.revealed ? 1 : 0)) / total) * 100}%`,
              height: "100%",
              backgroundColor: theme.colors.accent,
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: theme.spacing["3xl"],
            gap: theme.spacing.lg,
          }}
        >
          <Text variant="h3">{q.q}</Text>

          <View style={{ gap: theme.spacing.sm }}>
            {q.options.map((opt, idx) => (
              <ChoiceButton
                key={`${phase.qIdx}-${idx}`}
                label={opt}
                state={
                  !phase.revealed
                    ? "idle"
                    : idx === q.correctIdx
                      ? "correct"
                      : idx === phase.pickedIdx
                        ? "wrong"
                        : "muted"
                }
                onPress={() => pick(idx)}
              />
            ))}
          </View>

          {phase.revealed ? (
            <View
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                gap: theme.spacing.xs,
              }}
            >
              <Text variant="caption" color="tertiary">
                {t.listeningScenarios.revealHeader}
              </Text>
              <Text chinese variant="body">
                {story.bodyZh}
              </Text>
            </View>
          ) : null}

          {phase.revealed ? (
            <Button
              label={
                phase.qIdx + 1 >= total
                  ? t.listeningScenarios.finishLabel
                  : t.listeningScenarios.nextQuestion
              }
              size="lg"
              fullWidth
              onPress={advanceQuestion}
              rightIcon={<ChevronRight color={theme.colors.onAccent} size={20} strokeWidth={2.4} />}
            />
          ) : null}
        </ScrollView>
      </Screen>
    );
  }

  // ──────────────────────── Intro / Playing / Ready ────────────────────────
  const isPlaying = phase.kind === "playing";
  const isReady = phase.kind === "ready_for_quiz";
  const playedCount = isPlaying
    ? phase.sentenceIdx + 1
    : isReady
      ? sentences.length
      : 0;

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
            {t.listeningScenarios.section}
          </Text>
          <Text variant="h3" chinese numberOfLines={1}>
            {story.titleZh}
          </Text>
          <Text variant="small" color="secondary">
            {story.pinyinTitle}
          </Text>
        </View>
        <Text style={{ fontSize: 32 }}>{story.emoji}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
      >
        <Card padding="lg" bordered>
          <Text variant="bodyStrong">{t.listeningScenarios.introTitle}</Text>
          <Text variant="small" color="secondary" style={{ marginTop: 4 }}>
            {t.listeningScenarios.introBody}
          </Text>
        </Card>

        {/* Big play button */}
        <View style={{ alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.lg }}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Pressable
              onPress={isPlaying ? stopPlayback : playStory}
              accessibilityLabel={isPlaying ? t.listeningScenarios.stopLabel : t.listeningScenarios.playLabel}
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: isPlaying ? theme.colors.danger : theme.colors.accent,
                alignItems: "center",
                justifyContent: "center",
                ...theme.shadows.md,
              }}
            >
              {isPlaying ? (
                <Square color={theme.colors.onAccent} size={42} strokeWidth={2} fill={theme.colors.onAccent} />
              ) : (
                <Play color={theme.colors.onAccent} size={48} strokeWidth={2.4} fill={theme.colors.onAccent} />
              )}
            </Pressable>
          </Animated.View>
          <Text variant="caption" color="tertiary">
            {isPlaying
              ? fmt(t.listeningScenarios.playingLabel, { n: playedCount, total: sentences.length })
              : isReady
                ? fmt(t.listeningScenarios.playingLabel, { n: sentences.length, total: sentences.length })
                : t.listeningScenarios.playLabel}
          </Text>
        </View>

        {/* Replay + start quiz when audio finished */}
        {isReady ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={
                replays < MAX_REPLAYS
                  ? fmt(t.listeningScenarios.replayLabel, { n: MAX_REPLAYS - replays })
                  : t.listeningScenarios.replayNoneLabel
              }
              variant="secondary"
              disabled={replays >= MAX_REPLAYS}
              onPress={replay}
              leftIcon={<RotateCcw color={theme.colors.textPrimary} size={18} strokeWidth={2} />}
              fullWidth
            />
            <Button
              label={t.listeningScenarios.startQuizLabel}
              size="lg"
              fullWidth
              onPress={startQuiz}
              rightIcon={<Check color={theme.colors.onAccent} size={20} strokeWidth={2.4} />}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ──────────────────────── Choice button ────────────────────────

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
    { bg: string; border: string; text: "primary" | "onAccent" | "secondary" }
  > = {
    idle: { bg: theme.colors.surface, border: theme.colors.border, text: "primary" },
    correct: { bg: theme.colors.success, border: theme.colors.success, text: "onAccent" },
    wrong: { bg: theme.colors.danger, border: theme.colors.danger, text: "onAccent" },
    muted: { bg: theme.colors.surface, border: theme.colors.border, text: "secondary" },
  };
  const p = palette[state];
  return (
    <Pressable
      onPress={onPress}
      disabled={state !== "idle"}
      accessibilityRole="button"
      style={{
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: p.bg,
        borderWidth: 1,
        borderColor: p.border,
        opacity: state === "muted" ? 0.6 : 1,
      }}
    >
      <Text variant="body" color={p.text}>
        {label}
      </Text>
    </Pressable>
  );
}

// ──────────────────────── Helpers ────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function prepareQuestion(c: ComprehensionQuestion): PreparedQuestion {
  const options = shuffle([c.a, ...c.distractors]);
  return {
    q: c.q,
    correctIdx: options.indexOf(c.a),
    options,
  };
}

function splitIntoSentences(text: string): string[] {
  const parts = text.split(SENTENCE_DELIM);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] ?? "";
    const punct = parts[i + 1] ?? "";
    const combined = (body + punct).trim();
    if (combined.length > 0) out.push(combined);
  }
  return out;
}
