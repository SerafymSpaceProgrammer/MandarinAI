import { router } from "expo-router";
import { BookOpen, Compass, LibraryBig, ListChecks, Plus, Type } from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { EXERCISE_META, type ExerciseType } from "@/features/exercises/types";
import { useTheme } from "@/theme";

type Entry = {
  title: string;
  hint: string;
  Icon: React.ComponentType<LucideProps>;
  onPress: () => void;
  disabled?: boolean;
};

const EXERCISE_ORDER: ExerciseType[] = [
  "translate",
  "listen-and-pick",
  "tone-id",
  "match-pairs",
  "word-order",
  "fill-blank",
];

// CC-CEDICT keys for each exercise type's localized label/hint.
// EXERCISE_META holds the canonical emoji + min-words requirement; copy comes
// from the i18n dict so the chips translate alongside the rest of the UI.
const EXERCISE_LABEL_KEYS: Record<ExerciseType, { label: keyof ReturnType<typeof useT>["exercises"]["types"]; hint: keyof ReturnType<typeof useT>["exercises"]["types"] }> = {
  translate: { label: "translateLabel", hint: "translateHint" },
  "listen-and-pick": { label: "listenPickLabel", hint: "listenPickHint" },
  "match-pairs": { label: "matchPairsLabel", hint: "matchPairsHint" },
  "tone-id": { label: "toneIdLabel", hint: "toneIdHint" },
  "word-order": { label: "wordOrderLabel", hint: "wordOrderHint" },
  "fill-blank": { label: "fillBlankLabel", hint: "fillBlankHint" },
};

export default function Learn() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();

  const entries: Entry[] = [
    {
      title: t.learn.vocabularyReview,
      hint: t.learn.vocabularyReviewHint,
      Icon: BookOpen,
      onPress: () => router.push("/(app)/vocab/review"),
    },
    {
      title: t.learn.browseDeck,
      hint: t.learn.browseDeckHint,
      Icon: LibraryBig,
      onPress: () => router.push("/(app)/vocab/browse"),
    },
    {
      title: t.learn.addWord,
      hint: t.learn.addWordHint,
      Icon: Plus,
      onPress: () => router.push("/(app)/vocab/add"),
    },
    {
      title: t.learn.hskCatalog,
      hint: t.learn.hskCatalogHint,
      Icon: ListChecks,
      onPress: () => router.push("/(app)/hsk"),
    },
    {
      title: t.learn.characters,
      hint: t.learn.charactersHint,
      Icon: Type,
      onPress: () => router.push("/(app)/character"),
    },
    {
      title: t.learn.grammar,
      hint: t.learn.grammarHint,
      Icon: Compass,
      disabled: true,
      onPress: () => toast.info(t.learn.grammarSoon),
    },
  ];

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: theme.spacing["2xl"],
          gap: theme.spacing.xl,
          paddingBottom: theme.spacing["5xl"],
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            {t.learn.section}
          </Text>
          <Text variant="h1">{t.learn.title}</Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {entries.map((e) => (
            <Card
              key={e.title}
              onPress={e.onPress}
              accessibilityLabel={e.title}
              bordered
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.lg,
                opacity: e.disabled ? 0.55 : 1,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: theme.colors.accentMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <e.Icon color={theme.colors.accent} size={26} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{e.title}</Text>
                <Text variant="small" color="secondary">
                  {e.hint}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" color="tertiary">
              {t.learn.quickExercises}
            </Text>
            <Text variant="h3">{t.learn.quickExercisesTitle}</Text>
            <Text variant="small" color="secondary">
              {t.learn.quickExercisesHint}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {EXERCISE_ORDER.map((et) => {
              const meta = EXERCISE_META[et];
              const keys = EXERCISE_LABEL_KEYS[et];
              const label = t.exercises.types[keys.label];
              const hint = t.exercises.types[keys.hint];
              return (
                <Pressable
                  key={et}
                  onPress={() => router.push(`/(app)/exercises/${et}`)}
                  accessibilityLabel={label}
                  style={{
                    flexBasis: "47%",
                    flexGrow: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.radii.md,
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 28, lineHeight: 32 }}>{meta.emoji}</Text>
                  <Text variant="bodyStrong">{label}</Text>
                  <Text variant="small" color="tertiary" numberOfLines={2}>
                    {hint}
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
