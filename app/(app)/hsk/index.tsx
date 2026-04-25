import { router } from "expo-router";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Skeleton, Text } from "@/components/ui";
import {
  countByLevel,
  fetchTopics,
  type Syllabus,
  type Topic,
} from "@/features/hsk/hsk";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const LEVELS_BY_SYLLABUS: Record<Syllabus, number[]> = {
  old: [1, 2, 3, 4, 5, 6],
  // Currently only data for new syllabus levels 1-5; later imports can
  // extend through 9.
  new: [1, 2, 3, 4, 5],
};

type Mode = "level" | "topic";

export default function HskIndex() {
  const theme = useTheme();
  const profile = useUserStore((s) => s.profile);
  const lang = profile?.native_language ?? "en";

  const [mode, setMode] = useState<Mode>("level");
  const [syllabus, setSyllabus] = useState<Syllabus>("new");
  const [counts, setCounts] = useState<Map<number, number> | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);

  useEffect(() => {
    if (mode !== "level") return;
    let cancelled = false;
    setCounts(null);
    countByLevel(syllabus).then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, [syllabus, mode]);

  useEffect(() => {
    if (mode !== "topic") return;
    let cancelled = false;
    if (!topics) {
      fetchTopics().then((t) => {
        if (!cancelled) setTopics(t);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [mode, topics]);

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
          <Text variant="h3">{mode === "level" ? "Pick a level" : "Pick a topic"}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
      >
        {/* Top mode toggle: Level vs Topic */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            padding: 4,
            gap: 4,
          }}
        >
          {(["level", "topic"] as const).map((m) => {
            const active = m === mode;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: theme.radii.sm,
                  backgroundColor: active ? theme.colors.bg : "transparent",
                  alignItems: "center",
                }}
              >
                <Text variant="bodyStrong" color={active ? "primary" : "tertiary"}>
                  {m === "level" ? "By HSK level" : "By topic"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "level" ? (
          <>
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
              Browse by level. Tap any HSK level to see its words, save selections
              to your deck, or run a quick practice session.
            </Text>

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
          </>
        ) : (
          <>
            <Text variant="small" color="secondary">
              Topics are AI-classified across all 6,300+ HSK words. Pick one to
              study a focused vocabulary set.
            </Text>

            {topics === null ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {topics.map((t) => (
                  <TopicCard
                    key={t.id}
                    topic={t}
                    lang={lang}
                    onPress={() => router.push(`/(app)/hsk/topic/${t.id}`)}
                  />
                ))}
              </View>
            )}
          </>
        )}
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

function TopicCard({
  topic,
  lang,
  onPress,
}: {
  topic: Topic;
  lang: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const name = topic.name[lang] ?? topic.name.en ?? topic.id;
  const description = topic.description?.[lang] ?? topic.description?.en;

  return (
    <Card onPress={onPress} bordered padding="md">
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <Text style={{ fontSize: 32, lineHeight: 36 }}>{topic.emoji ?? "📦"}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: theme.spacing.sm,
            }}
          >
            <Text variant="bodyStrong">{name}</Text>
            <Text variant="caption" color="tertiary">
              {topic.word_count ?? 0} {topic.word_count === 1 ? "word" : "words"}
            </Text>
          </View>
          {description ? (
            <Text variant="small" color="secondary" numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
        <ChevronRight color={theme.colors.textTertiary} size={20} strokeWidth={2} />
      </View>
    </Card>
  );
}
