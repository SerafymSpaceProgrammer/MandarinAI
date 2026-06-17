import { router } from "expo-router";
import { Bell, ChevronRight } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Screen, Skeleton, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useHomeData } from "@/features/home/useHomeData";
import type { PlanItem } from "@/features/dailyPlan/generatePlan";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

// ─────────────────────────────────────────────────────────────────────────────
// Hero card always sits on its own dark burgundy plate, regardless of the app
// theme — like an ink-stamp poster pinned to the top of the screen. These
// tokens are kept local to the file so the rest of the app keeps owning its
// theme palette and this one signature surface stays consistent.
// ─────────────────────────────────────────────────────────────────────────────
const HERO_BG = "#1F0C10";
const HERO_GLOW = "#5A1C22";
const HERO_GOLD = "#E0B86A";
const HERO_GOLD_DIM = "rgba(224, 184, 106, 0.35)";
const HERO_TEXT = "#FFFFFF";
const HERO_TEXT_DIM = "rgba(255, 255, 255, 0.55)";
const HERO_DIVIDER = "rgba(255, 255, 255, 0.08)";
const HERO_WATERMARK = "rgba(255, 80, 90, 0.1)";

export default function Home() {
  const theme = useTheme();
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const home = useHomeData();

  const greetingNative = getGreeting(t);
  const greetingHanzi = getGreetingHanzi();
  const name = profile?.display_name ?? null;
  const goalMin = profile?.daily_goal_minutes ?? 15;
  const minutesLeft = Math.max(0, goalMin - home.minutesStudiedToday);
  const totalPlanMinutes = home.plan.reduce((s, p) => s + p.durationMin, 0);

  function openPlanItem(item: PlanItem) {
    if (item.href) router.push(item.href as never);
  }

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing["6xl"],
          gap: theme.spacing["2xl"],
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => home.refresh()}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Top bar — small hanzi+native greeting eyebrow, big name, bell */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="small" color="tertiary">
              <Text variant="small" color="tertiary" chinese>
                {greetingHanzi}
              </Text>
              {`  ·  ${greetingNative}`}
            </Text>
            <Text variant="h1" numberOfLines={1}>
              {name ?? t.home.studyTitle}
            </Text>
            {/* No accent bar — the hero card carries the visual weight here. */}
          </View>
          <NotificationBell hasDot={home.dueCount > 0} />
        </View>

        {/* HERO — streak + level ring + motivation + 3 mini-stats */}
        <HeroCard
          loading={home.loading}
          streak={home.streak}
          level={home.level}
          xpInto={home.xpIntoLevel}
          xpNext={home.xpForNextLevel}
          minutesToday={home.minutesStudiedToday}
          minutesLeftForGoal={minutesLeft}
          dueCount={home.dueCount}
          deckTotal={home.savedWordsTotal}
          t={t}
        />

        {/* Plan section */}
        <View style={{ gap: theme.spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 4,
                height: 22,
                borderRadius: 2,
                backgroundColor: theme.colors.accent,
              }}
            />
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: 15,
                fontWeight: "800",
                letterSpacing: 1.4,
              }}
            >
              {t.home.todaysPlan.toUpperCase()}
            </Text>
            <Text variant="small" color="tertiary">
              {fmt(t.home.planEstimate, { n: totalPlanMinutes })}
            </Text>
          </View>

          {home.loading ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Skeleton height={72} radius="lg" />
              <Skeleton height={72} radius="lg" />
              <Skeleton height={72} radius="lg" />
            </View>
          ) : home.plan.length === 0 ? (
            <View
              style={{
                padding: theme.spacing.lg,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text variant="body" color="secondary" align="center">
                {t.home.nothingToDo}
              </Text>
            </View>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {home.plan.map((item) => (
                <PlanRow
                  key={item.id}
                  item={item}
                  badge={badgeForPlanItem(item, home.dueCount)}
                  onPress={() => openPlanItem(item)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card
// ─────────────────────────────────────────────────────────────────────────────
function HeroCard({
  loading,
  streak,
  level,
  xpInto,
  xpNext,
  minutesToday,
  minutesLeftForGoal,
  dueCount,
  deckTotal,
  t,
}: {
  loading: boolean;
  streak: number;
  level: number;
  xpInto: number;
  xpNext: number;
  minutesToday: number;
  minutesLeftForGoal: number;
  dueCount: number;
  deckTotal: number;
  t: ReturnType<typeof useT>;
}) {
  const theme = useTheme();

  const motivation =
    minutesLeftForGoal > 0
      ? fmt(t.home.streakMotivation, { n: minutesLeftForGoal })
      : null;

  return (
    <View
      style={{
        backgroundColor: HERO_BG,
        borderRadius: theme.radii.xl,
        padding: theme.spacing["2xl"],
        gap: theme.spacing.lg,
        overflow: "hidden",
        ...theme.shadows.lg,
        shadowColor: "#000",
        shadowOpacity: 0.18,
      }}
    >
      {/* Background layers stacked behind every other child. RN paints
          siblings in declaration order, so listing these first makes them
          the lowest z. The card clips its overflow, so we can let the
          watermark spill outside its measured bounds for a more organic feel. */}
      <HeroBackdrop />

      {/* Decorative watermark hanzi — fills the card vertically so the card
          reads as an ink-print poster rather than a flat slab. Bottom-aligned
          and slid off the right edge so the bulk of the stroke sits behind
          the level ring + stats and only its calligraphic silhouette peeks
          on the right. */}
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -60,
          bottom: -40,
          fontSize: 360,
          lineHeight: 360,
          fontWeight: "900",
          color: HERO_WATERMARK,
        }}
      >
        永
      </Text>

      {/* Top row: streak number + level ring */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: HERO_GOLD,
              }}
            />
            <Text
              variant="caption"
              style={{ color: HERO_GOLD, letterSpacing: 1.4 }}
            >
              {t.home.streakLabel}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text
              style={{
                color: HERO_TEXT,
                fontSize: 64,
                lineHeight: 68,
                fontWeight: "800",
                letterSpacing: -1.5,
              }}
            >
              {loading ? "—" : `${streak}`}
            </Text>
            <Text
              style={{
                color: HERO_TEXT_DIM,
                fontSize: 16,
                lineHeight: 24,
                fontWeight: "500",
              }}
            >
              {t.home.daysLabel}
            </Text>
          </View>
        </View>

        <LevelRing level={level} xpInto={xpInto} xpNext={xpNext} t={t} />
      </View>

      {/* Motivation line */}
      {motivation ? (
        <Text
          style={{
            color: HERO_TEXT_DIM,
            fontSize: 14,
            lineHeight: 20,
            maxWidth: 260,
          }}
        >
          {motivation}
        </Text>
      ) : (
        <Text
          style={{
            color: HERO_TEXT_DIM,
            fontSize: 14,
            lineHeight: 20,
            maxWidth: 260,
          }}
        >
          {t.home.streakSafe}
        </Text>
      )}

      {/* Divider above mini-stats */}
      <View style={{ height: 1, backgroundColor: HERO_DIVIDER, marginTop: 4 }} />

      {/* 3 mini-stats */}
      <View style={{ flexDirection: "row" }}>
        <HeroStat
          label={t.home.statMinutesToday}
          value={loading ? "—" : `${minutesToday}`}
        />
        <HeroStatDivider />
        <HeroStat
          label={t.home.statDueReview}
          value={loading ? "—" : `${dueCount}`}
        />
        <HeroStatDivider />
        <HeroStat
          label={t.home.statDeckWords}
          value={loading ? "—" : `${deckTotal}`}
        />
      </View>
    </View>
  );
}

/**
 * Soft glow layer for the hero card. Two stacked radial gradients — a warm
 * burgundy halo on the right side (right behind the level ring) and a darker
 * vignette in the bottom-left corner — give the card the lit-poster look from
 * the design instead of flat paint.
 */
function HeroBackdrop() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="heroGlow" cx="78%" cy="38%" r="65%" fx="78%" fy="38%">
            <Stop offset="0%" stopColor={HERO_GLOW} stopOpacity={0.95} />
            <Stop offset="55%" stopColor={HERO_GLOW} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={HERO_GLOW} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="heroVignette" cx="10%" cy="100%" r="80%" fx="10%" fy="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#heroGlow)" />
        <Rect x={0} y={0} width={100} height={100} fill="url(#heroVignette)" />
      </Svg>
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text
        variant="caption"
        style={{ color: HERO_TEXT_DIM, letterSpacing: 1, fontSize: 10 }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: HERO_TEXT,
          fontSize: 24,
          lineHeight: 28,
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function HeroStatDivider() {
  return (
    <View
      style={{
        width: 1,
        marginHorizontal: 12,
        backgroundColor: HERO_DIVIDER,
      }}
    />
  );
}

/**
 * Circular level indicator drawn with two stacked SVG circles — a faint gold
 * track and a solid gold arc that fills clockwise from 12 o'clock based on
 * progress into the current level. Centered text shows "LVL N" and the
 * fractional XP toward the next level.
 */
function LevelRing({
  level,
  xpInto,
  xpNext,
  t,
}: {
  level: number;
  xpInto: number;
  xpNext: number;
  t: ReturnType<typeof useT>;
}) {
  const size = 92;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = xpNext > 0 ? Math.max(0, Math.min(1, xpInto / xpNext)) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        // Rotate so the arc starts at 12 o'clock, sweeping clockwise.
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={HERO_GOLD_DIM}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={HERO_GOLD}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Text
          style={{
            color: HERO_TEXT_DIM,
            fontSize: 9,
            lineHeight: 11,
            letterSpacing: 1.2,
            fontWeight: "600",
          }}
        >
          {t.home.levelShort}
        </Text>
        <Text
          style={{
            color: HERO_TEXT,
            fontSize: 22,
            lineHeight: 24,
            fontWeight: "800",
          }}
        >
          {level}
        </Text>
        <Text
          style={{
            color: HERO_TEXT_DIM,
            fontSize: 9,
            lineHeight: 11,
            fontWeight: "500",
            marginTop: 2,
          }}
        >
          {fmt(t.home.xpProgress, { into: xpInto, next: xpNext })}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan row
// ─────────────────────────────────────────────────────────────────────────────
function PlanRow({
  item,
  badge,
  onPress,
}: {
  item: PlanItem;
  badge: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        // Inner padding leaves room on the left for the red bar so the bar
        // sits flush to the rounded edge without crowding the emoji tile.
        paddingVertical: theme.spacing.md,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.md,
        gap: theme.spacing.md,
        opacity: pressed ? 0.88 : 1,
        overflow: "hidden",
      })}
    >
      {/* Red marker bar — present on every row, flush to the left edge and
          full height. Same visual rhythm as the section header. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: theme.colors.accent,
        }}
      />

      {/* Emoji tile */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.accentMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 26, lineHeight: 30 }}>{item.emoji}</Text>
      </View>

      {/* Title + subtitle */}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: theme.colors.textPrimary,
              fontSize: 17,
              lineHeight: 22,
              fontWeight: "700",
            }}
          >
            {item.title}
          </Text>
          {badge ? (
            <View
              style={{
                minWidth: 22,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 8,
                backgroundColor: theme.colors.accentMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: theme.colors.accent,
                  fontSize: 13,
                  lineHeight: 16,
                  fontWeight: "700",
                }}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="small" color="secondary" numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>

      {/* Round chevron button — circular accent-muted plate with a red arrow,
          matching the design's "press here" affordance on every row. */}
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: theme.colors.accentMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronRight color={theme.colors.accent} size={20} strokeWidth={2.6} />
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification bell — appears in the header. The dot is purely cosmetic for
// now; flips on whenever the user has due reviews to glance at.
// ─────────────────────────────────────────────────────────────────────────────
function NotificationBell({ hasDot }: { hasDot: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      onPress={() => {
        // Notifications hub will land later; for now the bell is a visual
        // anchor that matches the design without misleading the user.
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Bell color={theme.colors.textPrimary} size={20} strokeWidth={2} />
      {hasDot ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.accent,
            borderWidth: 2,
            borderColor: theme.colors.surface,
          }}
        />
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getGreeting(t: ReturnType<typeof useT>): string {
  const hour = new Date().getHours();
  if (hour < 5) return t.home.greetingLate;
  if (hour < 12) return t.home.greetingMorning;
  if (hour < 17) return t.home.greetingAfternoon;
  if (hour < 22) return t.home.greetingEvening;
  return t.home.greetingLate;
}

function getGreetingHanzi(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "夜好";
  if (hour < 12) return "早上好";
  if (hour < 17) return "下午好";
  if (hour < 22) return "晚上好";
  return "夜好";
}

/**
 * Match the existing plan emoji+title combos to a small numeric badge for
 * extra glanceability — e.g. "5" next to "Learn new words" because we plan
 * to feed 5 fresh words today. Falls back to `null` when no badge is helpful.
 */
function badgeForPlanItem(item: PlanItem, dueCount: number): string | null {
  switch (item.type) {
    case "vocab_review":
      return dueCount > 0 ? String(dueCount) : null;
    case "new_vocab":
      return "5";
    case "character_new":
      return "1";
    default:
      return null;
  }
}

