import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Card, PageHeader, Screen, Skeleton, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
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
  const t = useT();
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
      fetchTopics().then((rows) => {
        if (!cancelled) setTopics(rows);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [mode, topics]);

  const levels = LEVELS_BY_SYLLABUS[syllabus];

  return (
    <Screen padded>
      <PageHeader
        eyebrow={t.hsk.headerLabel}
        title={mode === "level" ? t.hsk.pickLevel : t.hsk.pickTopic}
      />

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
                  {m === "level" ? t.hsk.byLevel : t.hsk.byTopic}
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
                      {s === "new" ? t.hsk.syllabusNew : t.hsk.syllabusOld}
                    </Text>
                    <Text variant="caption" color="tertiary">
                      {s === "new" ? t.hsk.syllabusNewHint : t.hsk.syllabusOldHint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text variant="small" color="secondary">
              {t.hsk.levelHint}
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
              {t.hsk.topicHint}
            </Text>

            {topics === null ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
              </View>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {topics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    lang={lang}
                    onPress={() => router.push(`/(app)/hsk/topic/${topic.id}`)}
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
  const t = useT();

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
          <Text variant="bodyStrong">{fmt(t.hsk.topicHskBadge, { n: level })}</Text>
          {count == null ? (
            <Skeleton height={14} width="40%" />
          ) : (
            <Text variant="small" color="secondary">
              {fmt(count === 1 ? t.hsk.levelCardWordOne : t.hsk.levelCardWordOther, {
                n: count,
              })}
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
  const t = useT();
  const name = topic.name[lang] ?? topic.name.en ?? topic.id;
  const description = topic.description?.[lang] ?? topic.description?.en;
  const wordCount = topic.word_count ?? 0;

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
              {fmt(wordCount === 1 ? t.hsk.levelCardWordOne : t.hsk.levelCardWordOther, {
                n: wordCount,
              })}
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
