import { router } from "expo-router";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Skeleton, Text } from "@/components/ui";
import { countByLevel, type Syllabus } from "@/features/hsk/hsk";
import { useTheme } from "@/theme";

const LEVELS_BY_SYLLABUS: Record<Syllabus, number[]> = {
  old: [1, 2, 3, 4, 5, 6],
  // We currently only have data for the new syllabus levels 1-5; later
  // imports can extend through 9.
  new: [1, 2, 3, 4, 5],
};

export default function HskIndex() {
  const theme = useTheme();
  const [syllabus, setSyllabus] = useState<Syllabus>("new");
  const [counts, setCounts] = useState<Map<number, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCounts(null);
    countByLevel(syllabus).then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, [syllabus]);

  const levels = LEVELS_BY_SYLLABUS[syllabus];

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
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Back">
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            HSK catalog
          </Text>
          <Text variant="h3">Pick a level</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
      >
        {/* Syllabus toggle */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            padding: 4,
            gap: 4,
          }}
        >
          {(["new", "old"] as const).map((s) => {
            const active = s === syllabus;
            return (
              <Pressable
                key={s}
                onPress={() => setSyllabus(s)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: theme.radii.sm,
                  backgroundColor: active ? theme.colors.bg : "transparent",
                  alignItems: "center",
                }}
              >
                <Text variant="bodyStrong" color={active ? "primary" : "tertiary"}>
                  {s === "new" ? "HSK 3.0 (new)" : "HSK Classic"}
                </Text>
                <Text variant="caption" color="tertiary">
                  {s === "new" ? "2021 standard" : "Pre-2021"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="small" color="secondary">
          Tap a level to browse the words. From there you can save them to your deck or jump straight into a quick practice session.
        </Text>

        {/* Level cards */}
        <View style={{ gap: theme.spacing.md }}>
          {levels.map((lvl) => (
            <LevelCard
              key={`${syllabus}-${lvl}`}
              level={lvl}
              count={counts?.get(lvl)}
              onPress={() => router.push(`/(app)/hsk/${syllabus}/${lvl}`)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function LevelCard({
  level,
  count,
  onPress,
}: {
  level: number;
  count: number | undefined;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} bordered>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.lg }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.colors.accentMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="h3" color="accent">
            {level}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">HSK {level}</Text>
          {count == null ? (
            <Skeleton height={14} width="40%" />
          ) : (
            <Text variant="small" color="secondary">
              {count} {count === 1 ? "word" : "words"}
            </Text>
          )}
        </View>
        <ChevronRight color={theme.colors.textTertiary} size={20} strokeWidth={2} />
      </View>
    </Card>
  );
}
