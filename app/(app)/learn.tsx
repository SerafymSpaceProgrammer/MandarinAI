import { router } from "expo-router";
import { BookOpen, Compass, LibraryBig, ListChecks, Plus, Type } from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Text, useToast } from "@/components/ui";
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

export default function Learn() {
  const theme = useTheme();
  const toast = useToast();

  const entries: Entry[] = [
    {
      title: "Vocabulary review",
      hint: "SRS flashcards from your saved deck",
      Icon: BookOpen,
      onPress: () => router.push("/(app)/vocab/review"),
    },
    {
      title: "Browse deck",
      hint: "Search, filter, and manage saved words",
      Icon: LibraryBig,
      onPress: () => router.push("/(app)/vocab/browse"),
    },
    {
      title: "Add a word",
      hint: "Manual entry with auto-pinyin",
      Icon: Plus,
      onPress: () => router.push("/(app)/vocab/add"),
    },
    {
      title: "HSK catalog",
      hint: "Browse 6,300+ words by level — old + new syllabus",
      Icon: ListChecks,
      onPress: () => router.push("/(app)/hsk"),
    },
    {
      title: "Characters",
      hint: "5-step introduction + mnemonics · HSK 1",
      Icon: Type,
      onPress: () => router.push("/(app)/character"),
    },
    {
      title: "Grammar patterns",
      hint: "Coming later",
      Icon: Compass,
      disabled: true,
      onPress: () => toast.info("Grammar patterns arrive later"),
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
            Learn
          </Text>
          <Text variant="h1">Pick a mode</Text>
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
              Quick exercises
            </Text>
            <Text variant="h3">Drill from your deck</Text>
            <Text variant="small" color="secondary">
              10 rounds each, generated from words you've already saved.
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {EXERCISE_ORDER.map((t) => {
              const meta = EXERCISE_META[t];
              return (
                <Pressable
                  key={t}
                  onPress={() => router.push(`/(app)/exercises/${t}`)}
                  accessibilityLabel={meta.label}
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
                  <Text variant="bodyStrong">{meta.label}</Text>
                  <Text variant="small" color="tertiary" numberOfLines={2}>
                    {meta.hint}
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
