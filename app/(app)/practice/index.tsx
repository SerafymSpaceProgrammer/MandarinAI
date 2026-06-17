import { router } from "expo-router";
import {
  ChevronRight,
  Crown,
  Headphones,
  MessageSquare,
  Mic,
  PencilLine,
  Play,
  Zap,
} from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Screen, Text } from "@/components/ui";
import {
  usePracticeData,
  type LastSpeakingAttempt,
} from "@/features/practice/usePracticeData";
import { SCENARIOS, type Scenario } from "@/features/speaking/scenarios";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { useTheme } from "@/theme";

// ─────────────────────────────────────────────────────────────────────────────
// Per-mode visual tones — match the new design's pastel-tile palette so the
// 2×2 mode grid reads as a colourful family rather than four red-accented
// rows. Each tone also drives the stat-number colour at the bottom of the
// card so each mode "owns" a hue throughout.
// ─────────────────────────────────────────────────────────────────────────────
type ModeTone = {
  tile: string;
  fg: string;
  watermark: string;
};

const MODE_TONE_RED: ModeTone = {
  tile: "#FCE4E6",
  fg: "#E63946",
  watermark: "rgba(230, 57, 70, 0.08)",
};
const MODE_TONE_BLUE: ModeTone = {
  tile: "#E0EAFF",
  fg: "#3B6FE0",
  watermark: "rgba(59, 111, 224, 0.08)",
};
const MODE_TONE_PURPLE: ModeTone = {
  tile: "#EBE2FB",
  fg: "#7A48D6",
  watermark: "rgba(122, 72, 214, 0.08)",
};
const MODE_TONE_GREEN: ModeTone = {
  tile: "#DCEEDB",
  fg: "#2E8B57",
  watermark: "rgba(46, 139, 87, 0.08)",
};

// Daily challenge dark card uses the same poster colours as the home hero.
const CHALLENGE_BG = "#1F0C10";
const CHALLENGE_GOLD = "#E0B86A";
const CHALLENGE_TEXT = "#FFFFFF";
const CHALLENGE_TEXT_DIM = "rgba(255, 255, 255, 0.55)";
const CHALLENGE_WATERMARK = "rgba(255, 80, 90, 0.1)";
const CHALLENGE_TILE = "#5C1F26";

export default function Practice() {
  const theme = useTheme();
  const t = useT();
  const data = usePracticeData();

  // Top 6 speaking scenarios surfaced beneath the modes grid — keep them
  // sorted by HSK so the user sees the easiest ones first.
  const scenariosPreview = useMemo<Scenario[]>(
    () => [...SCENARIOS].sort((a, b) => a.hskLevel - b.hskLevel).slice(0, 6),
    [],
  );

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing["6xl"],
          gap: theme.spacing["2xl"],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar — eyebrow + big title + today's progress pill */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: theme.colors.accent,
                }}
              />
              <Text
                style={{
                  color: theme.colors.accent,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1.4,
                }}
              >
                {t.practiceTab.section.toUpperCase()}
              </Text>
              <Text variant="caption" color="tertiary" chinese style={{ fontSize: 13 }}>
                · 练
              </Text>
            </View>
            <Text variant="h1">{t.practiceTab.hubTitle}</Text>
          </View>
          <TodayPill
            minutes={data.minutesToday}
            goal={data.dailyGoalMinutes}
          />
        </View>

        {/* Last attempt — hides entirely when the user hasn't completed any
            speaking sessions yet. Once they have, it's the easiest re-entry
            into the same scenario, scored at a glance. */}
        {data.lastAttempt ? (
          <LastAttemptCard
            attempt={data.lastAttempt}
            onPress={() =>
              router.push(
                `/(app)/practice/session?id=${data.lastAttempt!.scenarioId}` as never,
              )
            }
          />
        ) : null}

        {/* MODES — 2×2 grid */}
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeader label={t.practiceTab.modesLabel} />
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <ModeCard
              hanziWatermark="说"
              tone={MODE_TONE_RED}
              Icon={Mic}
              title={t.practiceTab.modeSpeaking}
              subtitle={fmt(t.practiceTab.modeSpeakingSub, { n: SCENARIOS.length })}
              statNumber={fmt(t.practiceTab.statMinutes, { n: data.speakingMinutesThisWeek })}
              statLabel={t.practiceTab.statThisWeek}
              onPress={() => router.push("/(app)/practice/scenarios")}
            />
            <ModeCard
              hanziWatermark="听"
              tone={MODE_TONE_BLUE}
              Icon={Headphones}
              title={t.practiceTab.modeListening}
              subtitle={t.practiceTab.modeListeningSub}
              statNumber={fmt(t.practiceTab.statExercises, { n: data.listeningExercisesThisMonth })}
              statLabel={t.practiceTab.statThisMonth}
              onPress={() => router.push("/(app)/practice/listening")}
            />
          </View>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <ModeCard
              hanziWatermark="写"
              tone={MODE_TONE_PURPLE}
              Icon={PencilLine}
              title={t.practiceTab.modeWriting}
              subtitle={t.practiceTab.modeWritingSub}
              statNumber={`${data.charactersTouched}`}
              statLabel={t.practiceTab.statCharacters}
              onPress={() => router.push("/(app)/practice/writing")}
            />
            <ModeCard
              hanziWatermark="聊"
              tone={MODE_TONE_GREEN}
              Icon={MessageSquare}
              title={t.practiceTab.modeChat}
              subtitle={t.practiceTab.modeChatSub}
              statNumber="PRO"
              statLabel={t.practiceTab.statUnlimited}
              proBadge
              onPress={() => router.push("/(app)/practice/chat")}
            />
          </View>
        </View>

        {/* Speaking scenarios — horizontal scroll preview */}
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeader
            label={t.practiceTab.scenariosLabel}
            sublabel={t.practiceTab.scenariosSublabel}
            trailing={fmt(t.practiceTab.scenariosAll, { n: SCENARIOS.length })}
            onTrailingPress={() => router.push("/(app)/practice/scenarios")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.spacing.sm,
              paddingRight: theme.spacing.lg,
            }}
          >
            {scenariosPreview.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                onPress={() =>
                  router.push(`/(app)/practice/session?id=${s.id}` as never)
                }
              />
            ))}
          </ScrollView>
        </View>

        {/* Daily challenge — dark promo card */}
        <DailyChallengeCard
          onPress={() => router.push("/(app)/practice/scenarios")}
        />
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today pill — "12 / 20 today" with a leading red dot. Only filled when the
// user has logged at least a single minute today; otherwise it grays out.
// ─────────────────────────────────────────────────────────────────────────────
function TodayPill({ minutes, goal }: { minutes: number; goal: number }) {
  const theme = useTheme();
  const t = useT();
  const active = minutes > 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface,
        borderWidth: 1,
        borderColor: active ? "transparent" : theme.colors.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? theme.colors.accent : theme.colors.textTertiary,
        }}
      />
      <Text
        style={{
          color: active ? theme.colors.accent : theme.colors.textSecondary,
          fontSize: 13,
          lineHeight: 16,
          fontWeight: "700",
        }}
      >
        {fmt(t.practiceTab.todayPill, { minutes, goal })}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header — red bar + caps label, optional small lowercase sublabel
// and a tappable trailing link on the right.
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({
  label,
  sublabel,
  trailing,
  onTrailingPress,
}: {
  label: string;
  sublabel?: string;
  trailing?: string;
  onTrailingPress?: () => void;
}) {
  const theme = useTheme();
  return (
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
          fontSize: 14,
          fontWeight: "800",
          letterSpacing: 1.4,
        }}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text variant="small" color="tertiary">
          {sublabel}
        </Text>
      ) : null}
      <View style={{ flex: 1 }} />
      {trailing ? (
        <Pressable
          onPress={onTrailingPress}
          disabled={!onTrailingPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text variant="small" color="tertiary" style={{ fontWeight: "600" }}>
            {trailing}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Last attempt — the speaking session the user finished most recently. Big
// hanzi line, pinyin under it, a static "waveform" of bars in the mode
// colour, and a green pill in the top-right with the average score.
// ─────────────────────────────────────────────────────────────────────────────
function LastAttemptCard({
  attempt,
  onPress,
}: {
  attempt: LastSpeakingAttempt;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const scoreTone = scoreBadgeTone(attempt.score, t);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fmt(t.practiceTab.lastAttemptRepeatA11y, { title: attempt.scenarioTitle })}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        overflow: "hidden",
        opacity: pressed ? 0.96 : 1,
      })}
    >
      {/* Watermark hanzi behind the content — the first character of the
          recorded line, fading out to the right edge. */}
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -34,
          bottom: -38,
          fontSize: 200,
          lineHeight: 200,
          fontWeight: "900",
          color: "rgba(230, 57, 70, 0.06)",
        }}
      >
        言
      </Text>

      {/* Eyebrow + score pill row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Mic color={theme.colors.textTertiary} size={14} strokeWidth={2.2} />
            <Text
              style={{
                color: theme.colors.textTertiary,
                fontSize: 11,
                lineHeight: 14,
                letterSpacing: 1.4,
                fontWeight: "800",
              }}
            >
              {t.practiceTab.lastAttemptLabel}
            </Text>
          </View>
          <Text
            chinese
            numberOfLines={1}
            style={{
              color: theme.colors.textPrimary,
              fontSize: 22,
              lineHeight: 28,
              fontWeight: "800",
            }}
          >
            «{attempt.hanzi}»
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textSecondary,
              fontSize: 14,
              lineHeight: 18,
              fontFamily: "monospace",
            }}
          >
            {attempt.pinyin}
          </Text>
        </View>

        <ScorePill score={attempt.score} tone={scoreTone} />
      </View>

      {/* Static waveform — a row of bars where the first ~70% are coloured
          (the "played" portion) and the rest faded. Heights are computed
          from a fixed hash so the visualisation stays stable per render. */}
      <Waveform progress={0.7} fg="#E63946" bg={theme.colors.border} />

      {/* Footer row: scenario meta + repeat link */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.spacing.md,
        }}
      >
        <Text variant="small" color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
          {fmt(t.practiceTab.lastAttemptMeta, { title: attempt.scenarioTitle, n: attempt.hskLevel })}
        </Text>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: "700",
          }}
        >
          {t.practiceTab.lastAttemptRepeat}
        </Text>
      </View>
    </Pressable>
  );
}

function ScorePill({
  score,
  tone,
}: {
  score: number;
  tone: { bg: string; label: string };
}) {
  return (
    <View
      style={{
        width: 76,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: tone.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 26,
          lineHeight: 30,
          fontWeight: "900",
        }}
      >
        {score}
      </Text>
      <Text
        style={{
          color: "rgba(255,255,255,0.9)",
          fontSize: 9,
          lineHeight: 12,
          letterSpacing: 1.2,
          fontWeight: "800",
        }}
      >
        {tone.label}
      </Text>
    </View>
  );
}

function scoreBadgeTone(score: number, t: Translations): { bg: string; label: string } {
  if (score >= 85) return { bg: "#22A06B", label: t.practiceTab.scoreExcellent };
  if (score >= 70) return { bg: "#3B6FE0", label: t.practiceTab.scoreGood };
  if (score >= 50) return { bg: "#D97706", label: t.practiceTab.scoreOk };
  return { bg: "#9B7A30", label: t.practiceTab.scoreRetry };
}

// Pseudo-random but deterministic bar heights — uses the index so the bars
// don't reshuffle on every re-render of the card.
const WAVE_BAR_COUNT = 28;
function Waveform({
  progress,
  fg,
  bg,
}: {
  progress: number;
  fg: string;
  bg: string;
}) {
  const cutoff = Math.floor(progress * WAVE_BAR_COUNT);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        height: 44,
        marginTop: 4,
      }}
    >
      {Array.from({ length: WAVE_BAR_COUNT }).map((_, i) => {
        // Phased sine wave gives a nice "voice" silhouette without random.
        const t = i / WAVE_BAR_COUNT;
        const h = 8 + Math.abs(Math.sin(t * Math.PI * 3.2 + 0.7) * 32);
        const played = i < cutoff;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              borderRadius: 2,
              backgroundColor: played ? fg : bg,
              opacity: played ? (i < cutoff * 0.6 ? 0.95 : 0.55) : 1,
            }}
          />
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode card — colored hanzi tile on top, title + subtitle, then a divider
// and a single "stat" row at the bottom (big coloured number + small label).
// Optionally renders a PRO crown badge in the top-right.
// ─────────────────────────────────────────────────────────────────────────────
function ModeCard({
  hanziWatermark,
  tone,
  Icon,
  title,
  subtitle,
  statNumber,
  statLabel,
  proBadge,
  onPress,
}: {
  hanziWatermark: string;
  tone: ModeTone;
  Icon: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  title: string;
  subtitle: string;
  statNumber: string;
  statLabel: string;
  proBadge?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.md,
        gap: 10,
        minHeight: 196,
        overflow: "hidden",
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {/* Watermark hanzi behind everything. */}
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -28,
          top: -36,
          fontSize: 180,
          lineHeight: 180,
          fontWeight: "900",
          color: tone.watermark,
        }}
      >
        {hanziWatermark}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radii.md,
            backgroundColor: tone.tile,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon color={tone.fg} size={22} strokeWidth={2.2} />
        </View>
        {proBadge ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: "#1A1614",
            }}
          >
            <Crown color="#E0B86A" size={11} strokeWidth={2.4} fill="#E0B86A" />
            <Text
              style={{
                color: "#E0B86A",
                fontSize: 10,
                lineHeight: 12,
                fontWeight: "900",
                letterSpacing: 0.6,
              }}
            >
              PRO
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: 17,
            lineHeight: 22,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>
        <Text variant="small" color="secondary" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: theme.colors.border,
          marginTop: "auto",
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: tone.fg,
            fontSize: 20,
            lineHeight: 24,
            fontWeight: "900",
            letterSpacing: -0.3,
          }}
        >
          {statNumber}
        </Text>
        <Text variant="caption" color="tertiary" style={{ letterSpacing: 0 }}>
          {statLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario preview card — small horizontal-scroll tile that takes the user
// straight into a session. Emoji on the left, HSK badge on the right, title
// in the middle, and a red play icon + duration/turns line at the bottom.
// ─────────────────────────────────────────────────────────────────────────────
function ScenarioCard({
  scenario,
  onPress,
}: {
  scenario: Scenario;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={scenario.title}
      style={({ pressed }) => ({
        width: 168,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.surfaceHover,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 20, lineHeight: 24 }}>{scenario.emoji}</Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: theme.colors.accentMuted,
          }}
        >
          <Text
            style={{
              color: theme.colors.accent,
              fontSize: 11,
              lineHeight: 14,
              fontWeight: "800",
              letterSpacing: 0.3,
            }}
          >
            HSK {scenario.hskLevel}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={2}
        style={{
          color: theme.colors.textPrimary,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: "700",
        }}
      >
        {scenario.title}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Play
          color={theme.colors.accent}
          size={14}
          strokeWidth={2.4}
          fill={theme.colors.accent}
        />
        <Text variant="caption" color="tertiary" style={{ letterSpacing: 0 }}>
          {fmt(t.practiceTab.scenarioMeta, { min: scenario.minutes, turns: scenario.turns.length })}
        </Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily challenge — dark poster banner pinned to the bottom of the screen.
// Static for now; routes to the speaking scenarios picker so the user can
// pick a target dialogue. Backed by a static hanzi watermark (战 = "battle").
// ─────────────────────────────────────────────────────────────────────────────
function DailyChallengeCard({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.practiceTab.challengeA11y}
      style={({ pressed }) => ({
        backgroundColor: CHALLENGE_BG,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.md,
        overflow: "hidden",
        opacity: pressed ? 0.95 : 1,
        ...theme.shadows.md,
        shadowColor: "#000",
        shadowOpacity: 0.18,
      })}
    >
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -28,
          bottom: -44,
          fontSize: 180,
          lineHeight: 180,
          fontWeight: "900",
          color: CHALLENGE_WATERMARK,
        }}
      >
        战
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radii.md,
            backgroundColor: CHALLENGE_TILE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap color={CHALLENGE_GOLD} size={22} strokeWidth={2.4} fill={CHALLENGE_GOLD} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: CHALLENGE_GOLD,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 1.4,
              fontWeight: "800",
            }}
          >
            {fmt(t.practiceTab.challengeLabel, { xp: 50 })}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: CHALLENGE_TEXT,
              fontSize: 15,
              lineHeight: 20,
              fontWeight: "700",
            }}
          >
            {fmt(t.practiceTab.challengeTask, { hsk: 2, pct: 80 })}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: CHALLENGE_TEXT_DIM,
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            {fmt(t.practiceTab.challengeProgress, { done: 2, total: 5 })}
          </Text>
        </View>
        <ChevronRight color={CHALLENGE_TEXT_DIM} size={20} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}
