import { router } from "expo-router";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Flame,
  Sparkles,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { WordCard } from "@/components/cards/WordCard";
import { WordDetailSheet, type WordDetail } from "@/components/cards/WordDetailSheet";
import { Card, Screen, Skeleton, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useHomeData, type RecentWord } from "@/features/home/useHomeData";
import type { PlanItem } from "@/features/dailyPlan/generatePlan";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function Home() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const profile = useUserStore((s) => s.profile);
  const home = useHomeData();
  const [detail, setDetail] = useState<RecentWord | null>(null);

  const greeting = getGreeting(t);
  const name = profile?.display_name ?? null;

  function openPlanItem(item: PlanItem) {
    if (item.href) {
      router.push(item.href as never);
    } else {
      toast.info(fmt(t.home.laterPhase, { title: item.title }));
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
            <Text variant="h2">{name ? name : t.home.studyTitle}</Text>
          </View>
          <StreakChip streak={home.streak} />
        </View>

        {/* Today's plan */}
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text variant="h3">{t.home.todaysPlan}</Text>
            <Text variant="small" color="tertiary">
              {fmt(t.home.minGoal, { n: profile?.daily_goal_minutes ?? 15 })}
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
                  {t.home.nothingToDo}
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
                {t.common.continue}
              </Text>
              <ArrowRight color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>

        {/* Quick sessions */}
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h3">{t.home.quickSessions}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.md, paddingRight: theme.spacing.lg }}
          >
            <QuickChip
              emoji="🎧"
              label={t.home.quickAudio}
              hint={t.home.quickAudioHint}
              onPress={() => toast.info(t.home.listeningSoon)}
            />
            <QuickChip
              emoji="💬"
              label={t.home.quickChat}
              hint={t.home.quickChatHint}
              onPress={() => toast.info(t.home.aiChatSoon)}
            />
            <QuickChip
              emoji="🎲"
              label={t.home.quickDrill}
              hint={t.home.quickDrillHint}
              onPress={() => toast.info(t.home.drillsSoon)}
            />
            <QuickChip
              emoji="🔥"
              label={t.home.quickFlashcards}
              hint={
                home.dueCount > 0
                  ? fmt(t.home.quickFlashcardsDueNow, { n: home.dueCount })
                  : t.home.quickFlashcardsBrowse
              }
              onPress={() => router.push("/(app)/vocab/review")}
            />
            <QuickChip
              emoji="➕"
              label={t.home.quickAddWord}
              hint={t.home.quickAddWordHint}
              onPress={() => router.push("/(app)/vocab/add")}
            />
          </ScrollView>
        </View>

        {/* Recent from ChineseLens */}
        <View style={{ gap: theme.spacing.md }}>
          <Pressable
            onPress={() => router.push("/(app)/vocab/browse")}
            style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}
            accessibilityLabel={t.vocab.browse.title}
          >
            <Text variant="h3">{t.home.fromExtension}</Text>
            <Text variant="small" color="accent">
              {fmt(t.home.savedTotal, { n: home.savedWordsTotal })}
            </Text>
          </Pressable>

          {home.loading ? (
            <Card>
              <Skeleton height={60} />
            </Card>
          ) : home.recentWords.length === 0 ? (
            <Card bordered>
              <View style={{ gap: theme.spacing.xs, alignItems: "flex-start" }}>
                <Text variant="bodyStrong">{t.home.noSyncedWords}</Text>
                <Text variant="small" color="secondary">
                  {t.home.installExtension}
                </Text>
              </View>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {home.recentWords.map((w) => (
                <RecentWordRow
                  key={w.hanzi}
                  word={w}
                  hskLabel={t.vocab.browse.hskBadge}
                  onPress={() => setDetail(w)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Word detail sheet shared by every recent-word row */}
        <WordDetailSheet
          visible={detail !== null}
          onClose={() => setDetail(null)}
          word={
            detail
              ? {
                  hanzi: detail.hanzi,
                  pinyin: detail.pinyin,
                  english: detail.english,
                  hskLevel: detail.hsk_level,
                }
              : null
          }
        />

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
                {buildInsight(home.dueCount, home.savedWordsTotal, t)}
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
  const t = useT();
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
          {item.subtitle} · {fmt(t.common.minutesShort, { n: item.durationMin })}
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

function RecentWordRow({
  word,
  hskLabel,
  onPress,
}: {
  word: RecentWord;
  hskLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <WordCard
      hanzi={word.hanzi}
      pinyin={word.pinyin}
      english={word.english}
      onPress={onPress}
      trailing={
        word.hsk_level > 0 ? (
          <View
            style={{
              paddingVertical: 2,
              paddingHorizontal: 8,
              borderRadius: theme.radii.full,
              backgroundColor: theme.colors.accentMuted,
            }}
          >
            <Text variant="small" color="accent">
              {fmt(hskLabel, { n: word.hsk_level })}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function getGreeting(t: ReturnType<typeof useT>): string {
  const hour = new Date().getHours();
  if (hour < 5) return t.home.greetingLate;
  if (hour < 12) return t.home.greetingMorning;
  if (hour < 17) return t.home.greetingAfternoon;
  if (hour < 22) return t.home.greetingEvening;
  return t.home.greetingLate;
}

function buildInsight(
  dueCount: number,
  savedTotal: number,
  t: ReturnType<typeof useT>,
): string {
  if (dueCount >= 20) return fmt(t.home.insightDueLot, { n: dueCount });
  if (dueCount > 0) return fmt(t.home.insightDueSome, { n: dueCount });
  if (savedTotal === 0) return t.home.insightSaveFirst;
  if (savedTotal < 30) return fmt(t.home.insightDeckSmall, { n: savedTotal });
  return t.home.insightAllCaughtUp;
}
