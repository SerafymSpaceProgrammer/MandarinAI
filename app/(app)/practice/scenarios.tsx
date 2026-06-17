import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import {
  SCENARIOS,
  scenarioLevels,
  type Scenario,
} from "@/features/speaking/scenarios";
import { useTheme } from "@/theme";

type LevelFilter = "all" | number;

export default function ScenarioPicker() {
  const theme = useTheme();
  const t = useT();

  const levels = useMemo(() => scenarioLevels(), []);
  const [filter, setFilter] = useState<LevelFilter>("all");

  // When "all" is selected we group by HSK level so the user has a sense of
  // progression. When a specific level is selected we flatten to a clean list
  // of just that level's scenarios.
  const groups = useMemo<Array<{ level: number; scenarios: Scenario[] }>>(
    () => {
      if (filter === "all") {
        return levels.map((lvl) => ({
          level: lvl,
          scenarios: SCENARIOS.filter((s) => s.hskLevel === lvl),
        }));
      }
      return [{ level: filter, scenarios: SCENARIOS.filter((s) => s.hskLevel === filter) }];
    },
    [filter, levels],
  );

  return (
    <Screen>
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.speaking.title}
          </Text>
          <Text variant="h3">{t.speaking.pickScenario}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          paddingBottom: theme.spacing["5xl"],
        }}
      >
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.accentMuted,
            gap: 2,
          }}
        >
          <Text variant="caption" color="accent">
            {t.speaking.howItWorks}
          </Text>
          <Text variant="small">{t.speaking.howItWorksBody}</Text>
        </View>

        {/* Level filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          <FilterChip
            label="Все"
            count={SCENARIOS.length}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          {levels.map((lvl) => {
            const count = SCENARIOS.filter((s) => s.hskLevel === lvl).length;
            return (
              <FilterChip
                key={lvl}
                label={`HSK ${lvl}`}
                count={count}
                active={filter === lvl}
                onPress={() => setFilter(lvl)}
              />
            );
          })}
        </ScrollView>

        {groups.map((group) => (
          <View key={group.level} style={{ gap: theme.spacing.sm }}>
            {filter === "all" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.sm,
                }}
              >
                <Text variant="caption" color="tertiary">
                  HSK {group.level}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: theme.colors.border,
                  }}
                />
                <Text variant="caption" color="tertiary">
                  {group.scenarios.length}
                </Text>
              </View>
            ) : null}

            {group.scenarios.map((s) => (
              <Card
                key={s.id}
                onPress={() => router.push(`/(app)/practice/session?id=${s.id}`)}
                accessibilityLabel={s.title}
                bordered
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.lg,
                }}
              >
                <Text style={{ fontSize: 36, lineHeight: 40 }}>{s.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{s.title}</Text>
                  <Text variant="small" color="secondary" numberOfLines={2}>
                    {s.blurb}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                    <Badge text={fmt(t.speaking.badgeHsk, { n: s.hskLevel })} tone="accent" />
                    <Badge text={fmt(t.speaking.badgeMinutes, { n: s.minutes })} tone="neutral" />
                    <Badge
                      text={(() => {
                        const turnCount = s.turns.filter((turn) => turn.speaker === "you").length;
                        return fmt(
                          turnCount === 1 ? t.speaking.badgeTurnsOne : t.speaking.badgeTurnsOther,
                          { n: turnCount },
                        );
                      })()}
                      tone="neutral"
                    />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
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
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: 10,
        borderRadius: theme.radii.full,
        backgroundColor: active ? theme.colors.accent : theme.colors.surface,
        borderWidth: 1,
        borderColor: active ? theme.colors.accent : theme.colors.border,
      }}
    >
      <Text variant="smallStrong" color={active ? "onAccent" : "primary"}>
        {label}
      </Text>
      <Text
        variant="caption"
        color={active ? "onAccent" : "tertiary"}
        style={{ opacity: 0.85 }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function Badge({ text, tone }: { text: string; tone: "accent" | "neutral" }) {
  const theme = useTheme();
  const bg = tone === "accent" ? theme.colors.accentMuted : theme.colors.surfaceHover;
  const color: "accent" | "tertiary" = tone === "accent" ? "accent" : "tertiary";
  return (
    <View
      style={{
        paddingVertical: 1,
        paddingHorizontal: 8,
        borderRadius: theme.radii.full,
        backgroundColor: bg,
      }}
    >
      <Text variant="caption" color={color}>
        {text}
      </Text>
    </View>
  );
}
