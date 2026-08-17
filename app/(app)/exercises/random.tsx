import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { EXERCISE_META, type ExerciseType } from "@/features/exercises/types";
import { fetchAllWords, type SavedWord } from "@/features/vocab/vocab";
import { useT } from "@/i18n/i18n";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

// tone-pronounce is deliberately disabled (its Learn tile is commented out —
// the on-device scorer is too brittle). Keep it out of the random pool too,
// or the sprint can replace-navigate straight into the hidden exercise.
const DISABLED_TYPES: ReadonlyArray<ExerciseType> = ["tone-pronounce"];
const ALL_TYPES = (Object.keys(EXERCISE_META) as ExerciseType[]).filter(
  (type) => !DISABLED_TYPES.includes(type),
);

type Status = "loading" | "no_session" | "no_words" | "redirecting";

/**
 * Picks a random exercise type the user's deck can satisfy and replaces this
 * route with the runner. The empty state is the only branch that lingers —
 * everything else is transient (spinner → replace).
 */
export default function ExerciseRandom() {
  const theme = useTheme();
  const t = useT();
  const session = useUserStore((s) => s.session);
  const navigatedRef = useRef(false);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!session) {
      setStatus("no_session");
      return;
    }
    if (navigatedRef.current) return;
    let cancelled = false;
    (async () => {
      const words = await fetchAllWords(session.user.id);
      if (cancelled) return;

      const pick = pickRandomType(words);
      if (!pick) {
        setStatus("no_words");
        return;
      }

      navigatedRef.current = true;
      setStatus("redirecting");
      router.replace(`/(app)/exercises/${pick}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <Screen padded>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.lg }}>
        {status === "loading" || status === "redirecting" ? (
          <ActivityIndicator color={theme.colors.accent} size="large" />
        ) : status === "no_session" ? (
          <EmptyState
            title={t.exercisesRandom.noSessionTitle}
            body={t.exercisesRandom.noSessionBody}
            ctaLabel={t.exercisesRandom.noSessionCta}
            onCta={() => router.replace("/(app)/learn")}
          />
        ) : (
          <EmptyState
            title={t.exercisesRandom.emptyTitle}
            body={t.exercisesRandom.emptyBody}
            ctaLabel={t.exercisesRandom.emptyCta}
            onCta={() => router.replace("/(app)/hsk")}
          />
        )}
      </View>
    </Screen>
  );
}

function pickRandomType(words: SavedWord[]): ExerciseType | null {
  const unique = words.filter(
    (w, i, arr) => arr.findIndex((a) => a.hanzi === w.hanzi) === i,
  );
  const withContext = unique.filter((w) => (w.context_sentence ?? "").trim().length > 0);

  const eligible = ALL_TYPES.filter((type) => {
    const meta = EXERCISE_META[type];
    if (meta.needsContext) {
      return withContext.length >= meta.minWords;
    }
    return unique.length >= meta.minWords;
  });

  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)] ?? null;
}

function EmptyState({
  title,
  body,
  ctaLabel,
  onCta,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.xl }}>
      <Text variant="display" chinese style={{ color: theme.colors.accent }}>
        空
      </Text>
      <Text variant="h2" align="center">
        {title}
      </Text>
      <Text variant="body" color="secondary" align="center">
        {body}
      </Text>
      <Button label={ctaLabel} variant="secondary" onPress={onCta} />
    </View>
  );
}
