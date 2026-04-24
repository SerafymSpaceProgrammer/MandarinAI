import { Flame, Sparkles, Trophy } from "lucide-react-native";
import { RefreshControl, ScrollView, View } from "react-native";

import { Card, Screen, Skeleton, Text } from "@/components/ui";
import { Heatmap } from "@/components/stats/Heatmap";
import { HskBars } from "@/components/stats/HskBars";
import { SkillsGrid } from "@/components/stats/SkillsGrid";
import { useStats } from "@/features/stats/useStats";
import { useTheme } from "@/theme";

export default function Stats() {
  const theme = useTheme();
  const stats = useStats();

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: theme.spacing["2xl"],
          gap: theme.spacing.xl,
          paddingBottom: theme.spacing["5xl"],
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => stats.refresh()}
            tintColor={theme.colors.accent}
          />
        }
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            Progress
          </Text>
          <Text variant="h1">Stats</Text>
        </View>

        {/* Hero tiles */}
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <HeroTile
            Icon={Flame}
            label="Streak"
            value={stats.loading ? "—" : `${stats.streak}`}
            accent
          />
          <HeroTile
            Icon={Trophy}
            label="Level"
            value={stats.loading ? "—" : `${stats.level}`}
          />
        </View>

        {/* Level bar */}
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="small" color="secondary">
                Level {stats.level} progress
              </Text>
              <Text variant="small" color="tertiary">
                {stats.xpIntoLevel} / {stats.xpForNextLevel} XP
              </Text>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.colors.surface,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${(stats.xpIntoLevel / stats.xpForNextLevel) * 100}%`,
                  height: "100%",
                  backgroundColor: theme.colors.accent,
                }}
              />
            </View>
            <Text variant="caption" color="tertiary">
              Total {stats.totalXp} XP · Today +{stats.todaysXp} · {stats.todaysMinutes} min
            </Text>
          </View>
        </Card>

        {/* Insight */}
        <Card
          bordered
          style={{
            borderColor: theme.colors.accent,
            backgroundColor: theme.colors.accentMuted,
          }}
        >
          <View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "flex-start" }}>
            <Sparkles color={theme.colors.accent} size={22} strokeWidth={2} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="caption" color="accent">
                Insight
              </Text>
              <Text variant="bodyStrong">{stats.insight}</Text>
            </View>
          </View>
        </Card>

        {/* Heatmap */}
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text variant="h3">Activity</Text>
            <Text variant="small" color="tertiary">
              Last 13 weeks
            </Text>
          </View>
          {stats.loading ? (
            <Skeleton height={110} />
          ) : (
            <Heatmap activity={stats.activity} />
          )}
        </View>

        {/* HSK mastery */}
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h3">HSK mastery</Text>
          {stats.loading ? (
            <Skeleton height={150} />
          ) : (
            <HskBars rows={stats.hsk} />
          )}
        </View>

        {/* Skills (last 30d) */}
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h3">Skills</Text>
          {stats.loading ? (
            <Skeleton height={150} />
          ) : (
            <SkillsGrid totals={stats.skills30d} subtitle="Last 30 days" />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function HeroTile({
  Icon,
  label,
  value,
  accent,
}: {
  Icon: React.ComponentType<{ color: string; size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.md,
        backgroundColor: accent ? theme.colors.accentMuted : theme.colors.surface,
        borderWidth: 1,
        borderColor: accent ? theme.colors.accent : theme.colors.border,
        gap: theme.spacing.sm,
      }}
    >
      <Icon color={accent ? theme.colors.accent : theme.colors.textSecondary} size={22} strokeWidth={2.2} />
      <Text variant="display" style={{ fontSize: 36, lineHeight: 40 }} color={accent ? "accent" : "primary"}>
        {value}
      </Text>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
    </View>
  );
}
