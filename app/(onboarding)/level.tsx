import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useTheme } from "@/theme";

type Mode = "menu" | "test";

type Question = {
  hsk: number;
  english: string;
  correct: string;
  options: string[];
};

/**
 * One HSK-calibrated question per level. Distractors drawn from the same or
 * adjacent levels so wrong answers are still plausible.
 */
const QUESTIONS: Question[] = [
  { hsk: 1, english: "hello",      correct: "你好",   options: ["你好", "谢谢", "再见", "请"] },
  { hsk: 2, english: "time",       correct: "时间",   options: ["时间", "朋友", "漂亮", "开始"] },
  { hsk: 3, english: "to use",     correct: "使用",   options: ["使用", "健康", "环境", "简单"] },
  { hsk: 4, english: "to protect", correct: "保护",   options: ["保护", "方法", "比赛", "管理"] },
  { hsk: 5, english: "tradition",  correct: "传统",   options: ["传统", "创造", "集中", "程度"] },
  { hsk: 6, english: "sovereignty",correct: "主权",   options: ["主权", "辉煌", "凝聚", "繁衍"] },
];

export default function LevelStep() {
  const [mode, setMode] = useState<Mode>("menu");

  if (mode === "test") {
    return <PlacementTest onCancel={() => setMode("menu")} />;
  }
  return <LevelMenu onStartTest={() => setMode("test")} />;
}

function LevelMenu({ onStartTest }: { onStartTest: () => void }) {
  const theme = useTheme();
  const t = useT();
  const setDraft = useOnboardingStore((s) => s.set);
  const current = useOnboardingStore((s) => s.hsk_level);

  function pick(level: number) {
    setDraft({ hsk_level: level });
    router.push("/(onboarding)/goal");
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">{t.onboarding.level.title}</Text>
          <Text variant="body" color="secondary">
            {t.onboarding.level.hint}
          </Text>
        </View>

        <Card onPress={onStartTest} accessibilityLabel={t.onboarding.level.quickTest}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="bodyStrong">{t.onboarding.level.quickTest}</Text>
            <Text variant="small" color="secondary">
              {t.onboarding.level.quickTestHint}
            </Text>
          </View>
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" color="tertiary">
            {t.onboarding.level.orPickYourself}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {[1, 2, 3, 4, 5, 6].map((lvl) => {
              const active = current === lvl;
              return (
                <Pressable
                  key={lvl}
                  onPress={() => pick(lvl)}
                  style={{
                    flexBasis: "30%",
                    flexGrow: 1,
                    paddingVertical: theme.spacing.lg,
                    borderRadius: theme.radii.md,
                    backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text variant="h2" color={active ? "accent" : "primary"}>
                    {fmt(t.onboarding.level.hskLabel, { n: lvl })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function PlacementTest({ onCancel }: { onCancel: () => void }) {
  const theme = useTheme();
  const t = useT();
  const setDraft = useOnboardingStore((s) => s.set);
  const [index, setIndex] = useState(0);
  // Tracks the highest HSK level the user has answered correctly so far.
  const [highestCorrect, setHighestCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const q = QUESTIONS[index];

  // Randomize the 4 options once per question.
  const shuffledOptions = useMemo(() => {
    if (!q) return [];
    return [...q.options].sort(() => Math.random() - 0.5);
  }, [q]);

  if (!q) {
    return null;
  }

  function choose(option: string) {
    if (revealed) return;
    setPicked(option);
    setRevealed(true);
    if (option === q!.correct) {
      setHighestCorrect(q!.hsk);
    }
  }

  function next() {
    const nextIdx = index + 1;
    if (nextIdx < QUESTIONS.length) {
      setIndex(nextIdx);
      setPicked(null);
      setRevealed(false);
    } else {
      // Finished: HSK level = highest correct, or 1 if user got nothing right.
      const finalLevel = Math.max(1, highestCorrect);
      setDraft({ hsk_level: finalLevel });
      router.push("/(onboarding)/goal");
    }
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            {fmt(t.onboarding.level.counter, { hsk: q.hsk, n: index + 1, total: QUESTIONS.length })}
          </Text>
          <Text variant="h1">{fmt(t.onboarding.level.whichMeans, { english: q.english })}</Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {shuffledOptions.map((opt) => {
            const isPicked = picked === opt;
            const isCorrect = opt === q.correct;
            const showCorrect = revealed && isCorrect;
            const showWrong = revealed && isPicked && !isCorrect;

            const borderColor = showCorrect
              ? theme.colors.success
              : showWrong
                ? theme.colors.danger
                : theme.colors.border;

            return (
              <Pressable
                key={opt}
                onPress={() => choose(opt)}
                disabled={revealed}
                style={{
                  padding: theme.spacing.lg,
                  borderRadius: theme.radii.md,
                  borderWidth: 2,
                  borderColor,
                  backgroundColor: theme.colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text variant="h2" chinese>
                  {opt}
                </Text>
                {showCorrect ? <Text variant="h3" color="success">✓</Text> : null}
                {showWrong ? <Text variant="h3" color="danger">✕</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {revealed ? (
          <Button
            label={index + 1 < QUESTIONS.length ? t.onboarding.level.nextQuestion : t.onboarding.level.seeMyLevel}
            onPress={next}
            fullWidth
            size="lg"
          />
        ) : (
          <Button label={t.onboarding.level.iDontKnow} variant="ghost" onPress={onCancel} />
        )}
      </ScrollView>
    </Screen>
  );
}
