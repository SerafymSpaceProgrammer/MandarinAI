import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { recordActivity } from "@/features/activity/activity";
import { FillBlankCard } from "@/features/exercises/components/FillBlankCard";
import { ListenPickCard } from "@/features/exercises/components/ListenPickCard";
import { MatchPairsCard } from "@/features/exercises/components/MatchPairsCard";
import { ToneIdCard } from "@/features/exercises/components/ToneIdCard";
import { TranslateCard } from "@/features/exercises/components/TranslateCard";
import { WordOrderCard } from "@/features/exercises/components/WordOrderCard";
import { generateExercises } from "@/features/exercises/generator";
import {
  EXERCISE_I18N_KEYS,
  EXERCISE_META,
  type ExerciseType,
  type Question,
} from "@/features/exercises/types";
import { fetchAllWords } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const QUESTION_COUNT = 10;

function localizedLabel(t: Translations, type: ExerciseType): string {
  return t.exercises.types[EXERCISE_I18N_KEYS[type].label];
}

export default function ExerciseRunner() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const session = useUserStore((s) => s.session);
  const params = useLocalSearchParams<{ type?: string }>();
  const type = params.type as ExerciseType | undefined;
  const meta = type ? EXERCISE_META[type] : undefined;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!session || !type) return;
    let cancelled = false;
    (async () => {
      const words = await fetchAllWords(session.user.id);
      if (cancelled) return;
      const qs = generateExercises(type, words, QUESTION_COUNT);
      setQuestions(qs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, type]);

  function handleResult(correct: boolean) {
    if (correct) setCorrectCount((c) => c + 1);
    const next = index + 1;
    if (next >= questions.length) {
      if (session) {
        const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
        const xp = correctCount * 2 + (correct ? 2 : 0);
        recordActivity(session.user.id, {
          exercises_completed: questions.length,
          minutes_studied: minutes,
          xp_earned: xp,
        });
      }
      setFinished(true);
      return;
    }
    setIndex(next);
  }

  if (!meta || !type) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <Text variant="h2">{t.common.error}</Text>
          <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const label = localizedLabel(t, type);

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (questions.length === 0) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <Text variant="display" chinese style={{ color: theme.colors.accent }}>
            空
          </Text>
          <Text variant="h2" align="center">
            {t.exercises.runnerNotEnough}
          </Text>
          <Text variant="body" color="secondary" align="center" style={{ paddingHorizontal: theme.spacing.xl }}>
            {meta.needsContext
              ? t.exercises.runnerNeedsContext
              : fmt(t.exercises.runnerNeedsWords, { n: meta.minWords })}
          </Text>
          <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (finished) {
    return (
      <ExerciseSummary
        emoji={meta.emoji}
        label={label}
        type={meta.type}
        correct={correctCount}
        total={questions.length}
        onReplay={() => {
          setIndex(0);
          setCorrectCount(0);
          setFinished(false);
          // Regenerate fresh questions
          if (session) {
            fetchAllWords(session.user.id).then((words) => {
              setQuestions(generateExercises(meta.type, words, QUESTION_COUNT));
            });
          }
        }}
      />
    );
  }

  const q = questions[index];
  const progress = (index + 1) / questions.length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.close}>
            <X color={theme.colors.textSecondary} size={24} strokeWidth={2} />
          </Pressable>
          <Text variant="small" color="tertiary">
            {fmt(t.exercises.sectionLabel, {
              emoji: meta.emoji,
              label,
              n: index + 1,
              total: questions.length,
            })}
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
        }}
        keyboardShouldPersistTaps="handled"
      >
        {q ? <QuestionView key={`${meta.type}:${index}`} question={q} onResult={handleResult} /> : null}
      </ScrollView>
    </View>
  );
}

function QuestionView({
  question,
  onResult,
}: {
  question: Question;
  onResult: (correct: boolean) => void;
}) {
  switch (question.type) {
    case "translate":
      return <TranslateCard question={question} onResult={onResult} />;
    case "listen-and-pick":
      return <ListenPickCard question={question} onResult={onResult} />;
    case "match-pairs":
      return <MatchPairsCard question={question} onResult={onResult} />;
    case "tone-id":
      return <ToneIdCard question={question} onResult={onResult} />;
    case "word-order":
      return <WordOrderCard question={question} onResult={onResult} />;
    case "fill-blank":
      return <FillBlankCard question={question} onResult={onResult} />;
  }
}

function ExerciseSummary({
  emoji,
  label,
  correct,
  total,
  onReplay,
}: {
  emoji: string;
  label: string;
  type: ExerciseType;
  correct: number;
  total: number;
  onReplay: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const xp = correct * 2 + (total - correct);

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing["2xl"] }}>
        <View style={{ alignItems: "center", gap: theme.spacing.md }}>
          <Text style={{ fontSize: 72, lineHeight: 80 }}>{emoji}</Text>
          <Text variant="h1" align="center">
            {fmt(t.exercises.runnerSummaryTitle, { label })}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {fmt(t.exercises.runnerSummaryBody, { correct, total, accuracy, xp })}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t.exercises.runnerTryAgain} size="lg" fullWidth onPress={onReplay} />
          <Button
            label={t.exercises.runnerPickAnother}
            variant="secondary"
            fullWidth
            onPress={() => router.replace("/(app)/learn")}
          />
          <Button
            label={t.exercises.runnerHome}
            variant="ghost"
            fullWidth
            onPress={() => router.replace("/(app)")}
          />
        </View>
      </View>
    </Screen>
  );
}
