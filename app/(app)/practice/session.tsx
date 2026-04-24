import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Mic, Square, Volume2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Screen, Text, useToast } from "@/components/ui";
import { recordActivity } from "@/features/activity/activity";
import { findScenario, type Scenario, type ScenarioTurn } from "@/features/speaking/scenarios";
import { scorePronunciation, type PronunciationResult } from "@/features/speaking/score";
import { cancelActiveRecording, ensureMicPermission, startRecording } from "@/features/speaking/recorder";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type TurnOutcome = {
  turnIdx: number;
  score: number;
  transcript: string;
};

type PhaseState =
  | { kind: "idle" }
  | { kind: "recording"; stopFn: () => Promise<{ uri: string; mimeType: string } | null> }
  | { kind: "scoring" }
  | { kind: "revealed"; result: PronunciationResult };

export default function ScenarioSession() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const session = useUserStore((s) => s.session);
  const params = useLocalSearchParams<{ id?: string }>();
  const scenario = params.id ? findScenario(params.id) : undefined;

  const [turnIdx, setTurnIdx] = useState(0);
  const [phase, setPhase] = useState<PhaseState>({ kind: "idle" });
  const [outcomes, setOutcomes] = useState<TurnOutcome[]>([]);
  const [startedAt] = useState(() => Date.now());

  const current: ScenarioTurn | undefined = scenario?.turns[turnIdx];

  // Auto-play NPC turns on mount, then auto-advance after a short hold.
  useEffect(() => {
    if (!current) return;
    if (current.speaker !== "npc") return;
    Speech.stop().catch(() => {});
    const id = setTimeout(() => {
      Speech.speak(current.hanzi, { language: "zh-CN", rate: 0.9 });
    }, 250);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
  }, [current]);

  // Pulse animation on the mic while recording.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase.kind !== "recording") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase.kind, pulse]);

  if (!scenario || !current) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <Text variant="h2" align="center">Scenario not found</Text>
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const progress = (turnIdx + 1) / scenario.turns.length;

  async function playNpcAgain() {
    if (!current || current.speaker !== "npc") return;
    Speech.stop().catch(() => {});
    Speech.speak(current.hanzi, { language: "zh-CN", rate: 0.9 });
  }

  async function startRecord() {
    const granted = await ensureMicPermission();
    if (!granted) {
      toast.error("Microphone permission is needed");
      return;
    }
    try {
      const handle = await startRecording();
      setPhase({ kind: "recording", stopFn: handle.stop });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err) {
      toast.error("Couldn't start recording");
      console.warn(err);
    }
  }

  async function stopAndScore() {
    if (phase.kind !== "recording") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhase({ kind: "scoring" });
    const file = await phase.stopFn();
    if (!file || !current || current.speaker !== "you") {
      setPhase({ kind: "idle" });
      return;
    }

    const res = await scorePronunciation(file.uri, file.mimeType, current.hanzi);
    if (!res.ok) {
      setPhase({ kind: "idle" });
      const err = res.error;
      switch (err.kind) {
        case "audio_too_short":
          toast.info("That was too quiet — try holding the button a bit longer");
          return;
        case "daily_limit":
          toast.info(`Daily speaking limit reached (${err.used}/${err.limit})`);
          return;
        case "network":
          toast.error("Network error. Try again.");
          return;
        default:
          toast.error(`Something went wrong: ${err.kind}`);
          return;
      }
    }

    setPhase({ kind: "revealed", result: res.result });
    if (session) {
      recordActivity(session.user.id, {
        exercises_completed: 1,
        xp_earned: res.result.score >= 60 ? 3 : 1,
      });
    }
  }

  function nextTurn() {
    if (!scenario) return;
    if (phase.kind === "revealed" && current?.speaker === "you") {
      setOutcomes((prev) => [
        ...prev,
        {
          turnIdx,
          score: phase.result.score,
          transcript: phase.result.transcript,
        },
      ]);
    }
    const nextIdx = turnIdx + 1;
    if (nextIdx >= scenario.turns.length) {
      // Session over — record minutes and show summary inline.
      if (session) {
        const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
        recordActivity(session.user.id, { minutes_studied: minutes, conversations_completed: 1 });
      }
      setTurnIdx(nextIdx);
      setPhase({ kind: "idle" });
      return;
    }
    setTurnIdx(nextIdx);
    setPhase({ kind: "idle" });
  }

  async function quit() {
    await cancelActiveRecording();
    router.back();
  }

  const finished = turnIdx >= scenario.turns.length;

  // ────────────────────────── SUMMARY ──────────────────────────
  if (finished) {
    return <SessionSummary scenario={scenario} outcomes={outcomes} />;
  }

  // ────────────────────────── IN-SESSION ──────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Header + progress */}
      <View
        style={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={quit} hitSlop={16} accessibilityLabel="Exit">
            <X color={theme.colors.textSecondary} size={24} strokeWidth={2} />
          </Pressable>
          <Text variant="small" color="tertiary">
            {turnIdx + 1} / {scenario.turns.length}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View
          style={{
            height: 4,
            backgroundColor: theme.colors.surface,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              backgroundColor: theme.colors.accent,
            }}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.xl,
          paddingBottom: 120,
        }}
      >
        {/* Setting card, only on first turn */}
        {turnIdx === 0 ? (
          <View
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              gap: 2,
            }}
          >
            <Text variant="caption" color="tertiary">
              Setting
            </Text>
            <Text variant="small">{scenario.setting}</Text>
          </View>
        ) : null}

        {/* Current turn card */}
        <View
          style={{
            padding: theme.spacing.lg,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: current.speaker === "you" ? theme.colors.accent : theme.colors.border,
            backgroundColor: current.speaker === "you" ? theme.colors.accentMuted : theme.colors.surface,
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="caption" color={current.speaker === "you" ? "accent" : "tertiary"}>
              {current.speaker === "you" ? "YOUR LINE" : "THEY SAY"}
            </Text>
            {current.speaker === "npc" ? (
              <Pressable onPress={playNpcAgain} hitSlop={12} accessibilityLabel="Replay">
                <Volume2 color={theme.colors.textSecondary} size={20} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          <Text chinese variant="h1">
            {current.hanzi}
          </Text>
          <Text variant="pinyin" color="secondary">
            {current.pinyin}
          </Text>
          <Text variant="body" color="secondary">
            {current.english}
          </Text>
        </View>

        {/* Scoring feedback */}
        {phase.kind === "revealed" ? (
          <FeedbackCard expected={current.hanzi} result={phase.result} />
        ) : null}
      </ScrollView>

      {/* Bottom action area */}
      <View
        style={{
          padding: theme.spacing.lg,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          gap: theme.spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.bg,
        }}
      >
        {current.speaker === "npc" ? (
          <Button
            label="Continue"
            size="lg"
            fullWidth
            rightIcon={<ArrowRight color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
            onPress={nextTurn}
          />
        ) : phase.kind === "revealed" ? (
          <Button
            label="Next line"
            size="lg"
            fullWidth
            rightIcon={<ArrowRight color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
            onPress={nextTurn}
          />
        ) : (
          <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <Pressable
                onPress={phase.kind === "recording" ? stopAndScore : startRecord}
                disabled={phase.kind === "scoring"}
                accessibilityLabel={phase.kind === "recording" ? "Stop recording" : "Start recording"}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  backgroundColor:
                    phase.kind === "recording" ? theme.colors.danger : theme.colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: phase.kind === "scoring" ? 0.5 : 1,
                }}
              >
                {phase.kind === "recording" ? (
                  <Square color={theme.colors.onAccent} size={30} strokeWidth={2} fill={theme.colors.onAccent} />
                ) : (
                  <Mic color={theme.colors.onAccent} size={36} strokeWidth={2.2} />
                )}
              </Pressable>
            </Animated.View>
            <Text variant="small" color="tertiary">
              {phase.kind === "recording"
                ? "Tap to stop"
                : phase.kind === "scoring"
                  ? "Scoring…"
                  : "Tap and say the line"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ────────────────────────── FEEDBACK CARD ──────────────────────────
function FeedbackCard({ expected, result }: { expected: string; result: PronunciationResult }) {
  const theme = useTheme();

  const verdictColor: "success" | "warning" | "danger" =
    result.verdict === "excellent" || result.verdict === "good"
      ? "success"
      : result.verdict === "try_again"
        ? "warning"
        : "danger";

  const verdictLabel: Record<PronunciationResult["verdict"], string> = {
    excellent: "Excellent!",
    good: "Good — you got the core",
    try_again: "Close — try again",
    unclear: "Couldn't catch that",
  };

  return (
    <View
      style={{
        padding: theme.spacing.lg,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors[verdictColor],
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="bodyStrong" color={verdictColor}>
          {verdictLabel[result.verdict]}
        </Text>
        <Text variant="h2" color={verdictColor}>
          {result.score}%
        </Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="caption" color="tertiary">
          Expected → Heard
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {result.perChar.map((p, i) => (
            <Text
              key={i}
              chinese
              style={{
                fontSize: 24,
                color: p.matched ? theme.colors.success : theme.colors.danger,
                fontWeight: "700",
              }}
            >
              {p.char}
            </Text>
          ))}
        </View>
        {result.transcript ? (
          <Text variant="small" color="secondary">
            Heard: {result.transcript}
          </Text>
        ) : null}
      </View>

      <Text variant="caption" color="tertiary">
        Target: {expected}
      </Text>
    </View>
  );
}

// ────────────────────────── SUMMARY ──────────────────────────
function SessionSummary({ scenario, outcomes }: { scenario: Scenario; outcomes: TurnOutcome[] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const avg = outcomes.length
    ? Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length)
    : 0;
  const youTurns = scenario.turns.filter((t) => t.speaker === "you").length;
  const xp = outcomes.reduce((s, o) => s + (o.score >= 60 ? 3 : 1), 0);

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.xl,
        }}
      >
        <View style={{ alignItems: "center", gap: theme.spacing.md }}>
          <Text style={{ fontSize: 72, lineHeight: 80 }}>{scenario.emoji}</Text>
          <Text variant="h1" align="center">
            {scenario.title} done
          </Text>
          <Text variant="body" color="secondary" align="center">
            {outcomes.length} / {youTurns} turns scored · avg {avg}% · +{xp} XP
          </Text>
        </View>

        <View
          style={{
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: theme.spacing.md,
          }}
        >
          <Text variant="caption" color="tertiary">
            Transcript
          </Text>
          {scenario.turns.map((t, i) => {
            const outcome = outcomes.find((o) => o.turnIdx === i);
            const scoreColor: "success" | "warning" | "danger" | "tertiary" = outcome
              ? outcome.score >= 80
                ? "success"
                : outcome.score >= 50
                  ? "warning"
                  : "danger"
              : "tertiary";

            return (
              <View key={i} style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text variant="caption" color={t.speaker === "you" ? "accent" : "tertiary"}>
                    {t.speaker === "you" ? "YOU" : "NPC"}
                  </Text>
                  {outcome ? (
                    <Text variant="smallStrong" color={scoreColor}>
                      {outcome.score}%
                    </Text>
                  ) : null}
                </View>
                <Text chinese variant="bodyStrong">
                  {t.hanzi}
                </Text>
                <Text variant="small" color="secondary">
                  {t.english}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Practice again"
            size="lg"
            fullWidth
            onPress={() => router.replace(`/(app)/practice/session?id=${scenario.id}`)}
          />
          <Button
            label="Pick another scenario"
            variant="secondary"
            fullWidth
            onPress={() => router.replace("/(app)/practice/scenarios")}
          />
          <Button label="Done" variant="ghost" fullWidth onPress={() => router.replace("/(app)")} />
        </View>
      </ScrollView>
    </Screen>
  );
}
