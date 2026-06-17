import { router } from "expo-router";
import { ArrowLeft, ChevronRight, Headphones } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import {
  STORY_LEVELS,
  storiesWithComprehension,
  type GradedStory,
} from "@/features/reading/stories";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

type LevelFilter = "all" | 1 | 2 | 3;

export default function ListeningScenariosCatalog() {
  const theme = useTheme();
  const t = useT();
  const [level, setLevel] = useState<LevelFilter>("all");

  const stories = useMemo(() => storiesWithComprehension(level), [level]);

  return (
    <Screen padded>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.listeningScenarios.section}
          </Text>
          <Text variant="h3">{t.listeningScenarios.title}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" color="secondary">
          {t.listeningScenarios.subtitle}
        </Text>

        {/* HSK level pills */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing.sm,
          }}
        >
          <LevelChip
            label={t.listeningScenarios.hskAll}
            active={level === "all"}
            onPress={() => setLevel("all")}
          />
          {STORY_LEVELS.map((lvl) => (
            <LevelChip
              key={lvl}
              label={fmt(t.listeningScenarios.hskBadge, { n: lvl })}
              active={level === lvl}
              onPress={() => setLevel(lvl)}
            />
          ))}
        </View>

        {stories.length === 0 ? (
          <Text variant="small" color="tertiary" align="center" style={{ paddingVertical: theme.spacing.xl }}>
            {t.listeningScenarios.catalogEmpty}
          </Text>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {stories.map((s) => (
              <ScenarioRow key={s.id} story={s} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function LevelChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: 8,
        borderRadius: theme.radii.full,
        backgroundColor: active ? theme.colors.accent : theme.colors.surface,
        borderWidth: 1,
        borderColor: active ? theme.colors.accent : theme.colors.border,
      }}
    >
      <Text variant="smallStrong" color={active ? "onAccent" : "primary"}>
        {label}
      </Text>
    </Pressable>
  );
}

function ScenarioRow({ story }: { story: GradedStory }) {
  const theme = useTheme();
  const t = useT();
  const qCount = story.comprehension?.length ?? 0;

  return (
    <Pressable
      onPress={() =>
        router.push(`/(app)/practice/listening-scenario?id=${encodeURIComponent(story.id)}`)
      }
    >
      <Card padding="lg" bordered>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
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
            <Headphones color={theme.colors.accent} size={26} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Text chinese variant="bodyStrong">
                {story.titleZh}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: theme.radii.full,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text variant="caption" color="tertiary">
                  {fmt(t.listeningScenarios.hskBadge, { n: story.hskLevel })}
                </Text>
              </View>
            </View>
            <Text variant="small" color="secondary" numberOfLines={2}>
              {story.summaryEn}
            </Text>
            <Text variant="caption" color="tertiary">
              {fmt(t.listeningScenarios.storyMeta, { min: story.durationMin, q: qCount })}
            </Text>
          </View>
          <ChevronRight color={theme.colors.textTertiary} size={20} strokeWidth={2} />
        </View>
      </Card>
    </Pressable>
  );
}
