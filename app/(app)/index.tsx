import { router } from "expo-router";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Flame,
  Sparkles,
} from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Card, Screen, Skeleton, Text, useToast } from "@/components/ui";
import { useHomeData, type RecentWord } from "@/features/home/useHomeData";
import type { PlanItem } from "@/features/dailyPlan/generatePlan";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function Home() {
  const theme = useTheme();
  const toast = useToast();
  const profile = useUserStore((s) => s.profile);
  const home = useHomeData();

  const greeting = getGreeting();
  const name = profile?.display_name ?? null;

  function openPlanItem(item: PlanItem) {
    if (item.href) {
      router.push(item.href as never);
    } else {
      toast.info(`${item.title} lands in a later phase`);
    }
  }

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
            onRefresh={() => home.refresh()}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Greeting + streak */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" color="tertiary">
              {greeting}
            </Text>
            <Text variant="h2">{name ? name : "Let's study"}</Text>
          </View>
          <StreakChip streak={home.streak} />
        </View>

        {/* Today's plan */}
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text variant="h3">Today's plan</Text>
            <Text variant="small" color="tertiary">
              {profile?.daily_goal_minutes ?? 15} min goal
            </Text>
          </View>
          <Card padding="none">
            {home.loading ? (
              <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
                <Skeleton height={48} />
                <Skeleton height={48} />
                <Skeleton height={48} />
              </View>
            ) : home.plan.length === 0 ? (
              <View style={{ padding: theme.spacing.lg }}>
                <Text variant="body" color="secondary" align="center">
                  Nothing to do — lucky you.
                </Text>
              </View>
            ) : (
              home.plan.map((item, idx) => (
                <PlanRow
                  key={item.id}
                  item={item}
                  isLast={idx === home.plan.length - 1}
                  onPress={() => openPlanItem(item)}
                />
              ))
            )}
          </Card>

          {home.plan.length > 0 ? (
            <Pressable
              onPress={() => openPlanItem(home.plan[0]!)}
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radii.md,
                paddingVertical: theme.spacing.lg,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: theme.spacing.sm,
              }}
            >
              <Text variant="bodyStrong" color="onAccent">
                Continue
              </Text>
              <ArrowRight color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>

        {/* Quick sessions */}
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h3">Quick sessions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.md, paddingRight: theme.spacing.lg }}
          >
            <QuickChip
              emoji="🎧"
              label="5 min audio"
              hint="Listen to native speakers"
              onPress={() => toast.info("Listening coming soon")}
            />
            <QuickChip
              emoji="💬"
              label="AI chat"
              hint="Casual tutor talk"
              onPress={() => toast.info("AI chat coming soon")}
            />
            <QuickChip
              emoji="🎲"
              label="Random drill"
              hint="One-tap practice"
              onPress={() => toast.info("Drills coming soon")}
            />
            <QuickChip
              emoji="🔥"
              label="Flashcards"
              hint={home.dueCount > 0 ? `${home.dueCount} due now` : "Review deck"}
              onPress={() => router.push("/(app)/vocab/review")}
            />
            <QuickChip
              emoji="➕"
              label="Add a word"
              hint="Save a new term"
              onPress={() => router.push("/(app)/vocab/add")}
            />
          </ScrollView>
        </View>

        {/* Recent from ChineseLens */}
        <View style={{ gap: theme.spacing.md }}>
          <Pressable
            onPress={() => router.push("/(app)/vocab/browse")}
            style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}
            accessibilityLabel="Browse deck"
          >
            <Text variant="h3">From ChineseLens</Text>
            <Text variant="small" color="accent">
              {home.savedWordsTotal} saved ›
            </Text>
          </Pressable>

          {home.loading ? (
            <Card>
              <Skeleton height={60} />
            </Card>
          ) : home.recentWords.length === 0 ? (
            <Card bordered>
              <View style={{ gap: theme.spacing.xs, alignItems: "flex-start" }}>
                <Text variant="bodyStrong">No synced words yet</Text>
                <Text variant="small" color="secondary">
                  Install ChineseLens in Chrome and save a word to see it here.
                </Text>
              </View>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {home.recentWords.map((w) => (
                <RecentWordRow key={w.hanzi} word={w} />
              ))}
            </View>
          )}
        </View>

        {/* AI suggestion stub */}
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
              <Text variant="bodyStrong">
                {buildInsight(home.dueCount, home.savedWordsTotal)}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────
function StreakChip({ streak }: { streak: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.full,
        backgroundColor: streak > 0 ? theme.colors.accentMuted : theme.colors.surface,
      }}
    >
      <Flame
        color={streak > 0 ? theme.colors.accent : theme.colors.textTertiary}
        size={16}
        strokeWidth={2.4}
      />
      <Text variant="bodyStrong" color={streak > 0 ? "accent" : "tertiary"}>
        {streak}
      </Text>
    </View>
  );
}

function PlanRow({
  item,
  isLast,
  onPress,
}: {
  item: PlanItem;
  isLast: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const complete = item.progress >= 1;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text style={{ fontSize: 24, lineHeight: 28 }}>{item.emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{item.title}</Text>
        <Text variant="small" color="secondary">
          {item.subtitle} · {item.durationMin} min
        </Text>
      </View>
      {complete ? (
        <CheckCircle2 color={theme.colors.success} size={22} strokeWidth={2} />
      ) : (
        <ChevronRight color={theme.colors.textTertiary} size={20} strokeWidth={2} />
      )}
    </Pressable>
  );
}

function QuickChip({
  emoji,
  label,
  hint,
  onPress,
}: {
  emoji: string;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 148,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 24, lineHeight: 28 }}>{emoji}</Text>
      <Text variant="bodyStrong">{label}</Text>
      <Text variant="small" color="tertiary" numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}

function RecentWordRow({ word }: { word: RecentWord }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text chinese variant="h2">
        {word.hanzi}
      </Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small" color="secondary">
          {word.pinyin}
        </Text>
        <Text variant="body" numberOfLines={1}>
          {word.english}
        </Text>
      </View>
      {word.hsk_level > 0 ? (
        <View
          style={{
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.accentMuted,
          }}
        >
          <Text variant="small" color="accent">
            HSK {word.hsk_level}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Burning the midnight oil";
}

function buildInsight(dueCount: number, savedTotal: number): string {
  if (dueCount >= 20) {
    return `You have ${dueCount} cards due — tackle half now, the rest after lunch?`;
  }
  if (dueCount > 0) {
    return `${dueCount} reviews due today. A 5-minute session clears them out.`;
  }
  if (savedTotal === 0) {
    return "Save your first word to start building your deck — either here or in the ChineseLens extension.";
  }
  if (savedTotal < 30) {
    return `Your deck has ${savedTotal} words. Add 5 new ones today to hit escape velocity.`;
  }
  return "No reviews due — great moment to learn something new or try a speaking scenario.";
}
