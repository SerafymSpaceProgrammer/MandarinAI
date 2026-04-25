import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Screen, Text } from "@/components/ui";
import { StrokeQuiz, type StrokeQuizHandle } from "@/components/StrokeQuiz";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { recordActivity } from "@/features/activity/activity";
import { fetchDict, type CharacterDictRow } from "@/features/character/character";
import { fetchAllWords } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const SESSION_LIMIT = 10;

type Outcome = {
  hanzi: string;
  mistakes: number;
  totalStrokes: number;
};

function bareDictRow(hanzi: string): CharacterDictRow {
  return {
    hanzi,
    pinyin: [],
    meanings: [],
    hsk_level: null,
    frequency_rank: null,
    stroke_count: null,
    mnemonic_en: null,
    stroke_order_svg: null,
  };
}

/**
 * Writing trainer flow: walk through up to SESSION_LIMIT characters one at a
 * time, draw each stroke, and tally accuracy. Source is either the user's
 * saved deck or a single HSK level.
 */
export default function WritingSession() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const session = useUserStore((s) => s.session);
  const params = useLocalSearchParams<{ source?: string; level?: string }>();
  const source = params.source === "hsk" ? "hsk" : "deck";
  const hskLevel = Number(params.level ?? 1) || 1;

  const [loading, setLoading] = useState(true);
  const [chars, setChars] = useState<CharacterDictRow[]>([]);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [currentResult, setCurrentResult] = useState<Outcome | null>(null);
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const quizRef = useRef<StrokeQuizHandle>(null);

  // Resolve the source set once.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      // Fetch the source pool. For HSK we get full dict rows back already,
      // so we keep them as-is. For deck, we'll need to look up metadata for
      // each unique hanzi from characters_dict.
      let enriched: CharacterDictRow[] = [];
      if (source === "deck") {
        const words = await fetchAllWords(session.user.id);
        if (cancelled) return;
        const pool = Array.from(
          new Set(words.flatMap((w) => Array.from(w.hanzi))),
        ).filter((c) => /\p{Script=Han}/u.test(c));
        if (pool.length === 0) {
          if (!cancelled) {
            setChars([]);
            setLoading(false);
          }
          return;
        }
        const shuffled = [...pool]
          .sort(() => Math.random() - 0.5)
          .slice(0, SESSION_LIMIT);
        const dict = await fetchDict();
        if (cancelled) return;
        const byHanzi = new Map(dict.map((d) => [d.hanzi, d] as const));
        enriched = shuffled.map((h) => byHanzi.get(h) ?? bareDictRow(h));
      } else {
        const dict = await fetchDict(hskLevel);
        if (cancelled) return;
        enriched = [...dict]
          .sort(() => Math.random() - 0.5)
          .slice(0, SESSION_LIMIT);
      }

      if (!cancelled) {
        setChars(enriched);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, source, hskLevel]);

  const current = chars[index];

  function handleComplete(info: { mistakes: number; totalStrokes: number }) {
    if (!current) return;
    setCurrentResult({
      hanzi: current.hanzi,
      mistakes: info.mistakes,
      totalStrokes: info.totalStrokes,
    });
  }

  function next() {
    if (!currentResult) return;
    const nextOutcomes = [...outcomes, currentResult];
    setOutcomes(nextOutcomes);
    setCurrentResult(null);

    const nextIdx = index + 1;
    if (nextIdx >= chars.length) {
      // Done — record activity then flip to summary.
      if (session) {
        const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
        const totalStrokes = nextOutcomes.reduce((s, o) => s + o.totalStrokes, 0);
        const totalMistakes = nextOutcomes.reduce((s, o) => s + o.mistakes, 0);
        const xp = Math.max(1, totalStrokes - totalMistakes);
        recordActivity(session.user.id, {
          minutes_studied: minutes,
          characters_learned: nextOutcomes.length,
          xp_earned: xp,
        });
      }
      setFinished(true);
      return;
    }
    setIndex(nextIdx);
  }

  function quit() {
    Alert.alert(t.writing.confirmExitTitle, t.writing.confirmExitBody, [
      { text: t.writing.confirmExitNo, style: "cancel" },
      { text: t.writing.confirmExitYes, style: "destructive", onPress: () => router.back() },
    ]);
  }

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  // ── Empty state ────────────────────────────────────────
  if (chars.length === 0) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <Text variant="display" chinese style={{ color: theme.colors.accent }}>
            空
          </Text>
          <Text variant="h2" align="center">
            {t.writing.sessionEmpty}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {t.writing.sessionEmptyHint}
          </Text>
          <Button label={t.writing.backToList} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (finished) {
    return <WritingSummary outcomes={outcomes} startedAt={startedAt} />;
  }

  if (!current) return null;

  const progress = (index + 1) / chars.length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={quit} hitSlop={16} accessibilityLabel={t.common.close}>
            <X color={theme.colors.textSecondary} size={24} strokeWidth={2} />
          </Pressable>
          <Text variant="small" color="tertiary">
            {fmt(t.writing.counter, { n: index + 1, total: chars.length })}
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
          gap: theme.spacing.lg,
          paddingBottom: 140,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Character info */}
        <View style={{ alignItems: "center", gap: 4 }}>
          {current.pinyin.length > 0 ? (
            <Text variant="pinyin" color="accent">
              {current.pinyin.join(" / ")}
            </Text>
          ) : null}
          {current.meanings[0] ? (
            <Text variant="body" color="secondary" numberOfLines={2} align="center">
              {current.meanings[0]}
            </Text>
          ) : null}
        </View>

        {/* Quiz canvas */}
        <StrokeQuiz
          // Force a fresh component each character so internal state resets.
          key={current.hanzi + ":" + index}
          ref={quizRef}
          hanzi={current.hanzi}
          size={300}
          onComplete={handleComplete}
        />

        {/* Result line below the canvas */}
        {currentResult ? (
          <View
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor:
                currentResult.mistakes === 0 ? theme.colors.accentMuted : theme.colors.surface,
              borderWidth: 1,
              borderColor:
                currentResult.mistakes === 0 ? theme.colors.success : theme.colors.border,
              alignItems: "center",
              gap: 2,
            }}
          >
            <Text variant="bodyStrong" color={currentResult.mistakes === 0 ? "success" : "primary"}>
              {currentResult.mistakes === 0
                ? t.writing.allStrokesDone
                : fmt(
                    currentResult.mistakes === 1
                      ? t.writing.mistakesOne
                      : t.writing.mistakesOther,
                    { n: currentResult.mistakes },
                  )}
            </Text>
            <Text variant="caption" color="tertiary">
              {fmt(t.writing.progress, {
                drawn: currentResult.totalStrokes,
                total: currentResult.totalStrokes,
              })}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom action area */}
      <View
        style={{
          padding: theme.spacing.lg,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.bg,
        }}
      >
        <Button
          label={index + 1 >= chars.length ? t.writing.finish : t.writing.next}
          size="lg"
          fullWidth
          disabled={!currentResult}
          rightIcon={
            currentResult ? (
              <ArrowRight color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
            ) : undefined
          }
          onPress={next}
        />
      </View>
    </View>
  );
}

function WritingSummary({ outcomes, startedAt }: { outcomes: Outcome[]; startedAt: number }) {
  const theme = useTheme();
  const t = useT();

  const totalStrokes = outcomes.reduce((s, o) => s + o.totalStrokes, 0);
  const totalMistakes = outcomes.reduce((s, o) => s + o.mistakes, 0);
  const accuracy =
    totalStrokes === 0
      ? 0
      : Math.round(((totalStrokes - totalMistakes) / totalStrokes) * 100);
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
  const xp = Math.max(1, totalStrokes - totalMistakes);

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.xl,
        }}
      >
        <View style={{ alignItems: "center", gap: theme.spacing.md }}>
          <Text chinese style={{ fontSize: 64, lineHeight: 72, color: theme.colors.accent, fontWeight: "700" }}>
            写
          </Text>
          <Text variant="h1" align="center">
            {t.writing.summaryTitle}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {fmt(t.writing.summarySubtitle, {
              characters: outcomes.length,
              accuracy,
              minutes,
              xp,
            })}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            padding: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Stat label={t.writing.summaryAccuracy} value={`${accuracy}%`} color="success" />
          <Stat label={t.writing.summaryCharacters} value={String(outcomes.length)} />
          <Stat
            label={t.writing.summaryMistakes}
            value={String(totalMistakes)}
            color={totalMistakes === 0 ? "success" : "warning"}
          />
        </View>

        {/* Per-character recap */}
        <View
          style={{
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: theme.spacing.sm,
          }}
        >
          {outcomes.map((o, i) => {
            const acc =
              o.totalStrokes === 0
                ? 0
                : Math.round(((o.totalStrokes - o.mistakes) / o.totalStrokes) * 100);
            const tone: "success" | "warning" | "danger" =
              acc >= 90 ? "success" : acc >= 60 ? "warning" : "danger";
            return (
              <View
                key={`${o.hanzi}-${i}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.md,
                }}
              >
                <Text chinese variant="h2">
                  {o.hanzi}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="small" color="secondary">
                    {fmt(t.writing.progress, { drawn: o.totalStrokes, total: o.totalStrokes })}
                  </Text>
                  {o.mistakes > 0 ? (
                    <Text variant="caption" color="tertiary">
                      {fmt(o.mistakes === 1 ? t.writing.mistakesOne : t.writing.mistakesOther, {
                        n: o.mistakes,
                      })}
                    </Text>
                  ) : null}
                </View>
                <Text variant="bodyStrong" color={tone}>
                  {acc}%
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={t.writing.practiceAgain}
            size="lg"
            fullWidth
            onPress={() => router.replace("/(app)/practice/writing")}
          />
          <Button
            label={t.writing.pickAnother}
            variant="secondary"
            fullWidth
            onPress={() => router.replace("/(app)/practice/writing")}
          />
          <Button
            label={t.common.done}
            variant="ghost"
            fullWidth
            onPress={() => router.replace("/(app)")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({
  label,
  value,
  color = "primary",
}: {
  label: string;
  value: string;
  color?: "primary" | "success" | "warning";
}) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text variant="h2" color={color}>
        {value}
      </Text>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
    </View>
  );
}
