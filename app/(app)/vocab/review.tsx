import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { recordActivity } from "@/features/activity/activity";
import { GradeButtons } from "@/features/vocab/components/GradeButtons";
import { ListeningCard } from "@/features/vocab/components/ListeningCard";
import { ProductionCard } from "@/features/vocab/components/ProductionCard";
import { RecognitionCard } from "@/features/vocab/components/RecognitionCard";
import { fetchDueCards, gradeCard, type SavedWord } from "@/features/vocab/vocab";
import {
  asEphemeralCard,
  fetchByTopic,
  fetchCatalog,
  fetchTranslations,
  type Syllabus,
} from "@/features/hsk/hsk";
import type { ReviewGrade } from "@/features/vocab/srs";
import { Button, Screen, Text } from "@/components/ui";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const SESSION_LIMIT = 20;

type CardVariant = "recognition" | "production" | "listening";

/**
 * Rotate through card variants based on how many reps the card has seen.
 * Mirrors REBUILD_PLAN section 4.3: reps 0 = recognition, reps 1 = listening,
 * reps 2 = production, reps 3+ = random.
 */
function pickVariant(card: SavedWord): CardVariant {
  const reps = card.review_count;
  if (reps === 0) return "recognition";
  if (reps === 1) return "listening";
  if (reps === 2) return "production";
  const pool: CardVariant[] = ["recognition", "listening", "production"];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export default function ReviewSession() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const params = useLocalSearchParams<{
    mode?: string;
    syllabus?: string;
    level?: string;
    topic?: string;
  }>();

  // Ephemeral practice modes pull words from the HSK catalog without
  // committing them to saved_words. Grades only update daily_activity
  // counters; nothing about the underlying word state is persisted.
  const isHskLevelMode = params.mode === "hsk";
  const isHskTopicMode = params.mode === "hsk-topic";
  const isEphemeral = isHskLevelMode || isHskTopicMode;

  const hskSyllabus = (params.syllabus === "old" ? "old" : "new") as Syllabus;
  const hskLevel = Number(params.level ?? 0) || 1;
  const topicId = params.topic ?? "";

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<SavedWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [startedAt] = useState(() => Date.now());

  const current = cards[index];
  const variant = useMemo(() => (current ? pickVariant(current) : null), [current]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (isEphemeral) {
        const lang = profile?.native_language ?? "en";
        const catalog = isHskTopicMode
          ? await fetchByTopic(topicId)
          : await fetchCatalog(hskSyllabus, hskLevel);
        // Random 20-card sample so repeat practice doesn't stale.
        const shuffled = [...catalog].sort(() => Math.random() - 0.5).slice(0, SESSION_LIMIT);
        const meanings = await fetchTranslations(
          shuffled.map((w) => w.hanzi),
          lang,
        );
        const ephemeral = shuffled.map((w) =>
          asEphemeralCard(w, meanings[w.hanzi]?.[0] ?? "", session.user.id),
        );
        if (!cancelled) {
          setCards(ephemeral);
          setLoading(false);
        }
      } else {
        const data = await fetchDueCards(session.user.id, SESSION_LIMIT);
        if (!cancelled) {
          setCards(data);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, isEphemeral, isHskTopicMode, hskSyllabus, hskLevel, topicId, profile?.native_language]);

  async function handleGrade(grade: ReviewGrade) {
    if (!session || !current) return;
    if (grade !== "again") {
      setCorrectCount((c) => c + 1);
    }

    // In HSK practice modes we don't write anything back to saved_words —
    // the cards aren't in the deck. Activity counters still update so XP
    // and streaks reflect the work.
    if (!isEphemeral) {
      gradeCard(session.user.id, current.hanzi, current, grade);
    }
    recordActivity(session.user.id, { words_reviewed: 1, xp_earned: grade === "again" ? 1 : 2 });

    const isLast = index + 1 >= cards.length;
    if (isLast) {
      const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
      recordActivity(session.user.id, { minutes_studied: minutes });
      router.replace({
        pathname: "/(app)/vocab/summary",
        params: {
          reviewed: String(cards.length),
          correct: String(correctCount + (grade !== "again" ? 1 : 0)),
          minutes: String(minutes),
        },
      });
      return;
    }

    setIndex((i) => i + 1);
    setRevealed(false);
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
  if (cards.length === 0) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <Text variant="display" chinese style={{ color: theme.colors.accent }}>
            休息
          </Text>
          <Text variant="h2" align="center">
            No cards due
          </Text>
          <Text variant="body" color="secondary" align="center">
            Come back later, or add new words to get more practice.
          </Text>
          <View style={{ height: theme.spacing.xl }} />
          <Button label="Add a word" fullWidth onPress={() => router.replace("/(app)/vocab/add")} />
          <Button label="Back home" variant="ghost" fullWidth onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (!current || !variant) return null;

  // Pick 3 distractors for Listening cards — other cards from the session.
  const distractors = cards.filter((c) => c.hanzi !== current.hanzi);

  const progress = (index + 1) / cards.length;

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Exit review"
            hitSlop={16}
          >
            <X color={theme.colors.textSecondary} size={24} strokeWidth={2} />
          </Pressable>
          <Text variant="small" color="tertiary">
            {index + 1} / {cards.length}
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

      {/* Card area */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        {variant === "recognition" ? (
          <RecognitionCard
            key={current.hanzi + index}
            card={current}
            onRevealed={() => setRevealed(true)}
          />
        ) : variant === "production" ? (
          <ProductionCard
            key={current.hanzi + index}
            card={current}
            onRevealed={() => setRevealed(true)}
          />
        ) : (
          <ListeningCard
            key={current.hanzi + index}
            card={current}
            distractors={distractors}
            onRevealed={() => setRevealed(true)}
          />
        )}

        {revealed ? (
          <GradeButtons card={current} onGrade={handleGrade} />
        ) : (
          <View style={{ height: 76 }} />
        )}
      </View>
    </View>
  );
}
