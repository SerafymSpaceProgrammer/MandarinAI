import { router } from "expo-router";
import {
  ChevronRight,
  Dices,
  Headphones,
  ListOrdered,
  // Mic, // used by the temporarily disabled "tone-pronounce" tile below
  MinusSquare,
  Music,
  Play,
  Puzzle,
  Repeat,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Screen, Skeleton, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { type ExerciseType } from "@/features/exercises/types";
import { useLearnData } from "@/features/learn/useLearnData";
import type { Topic } from "@/features/hsk/hsk";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

// ─────────────────────────────────────────────────────────────────────────────
// The continue card on Learn shares the same ink-stamp poster look as the
// Home hero — dark burgundy with a hanzi watermark — so the two top-of-tab
// surfaces feel like part of one set.
// ─────────────────────────────────────────────────────────────────────────────
const HERO_BG = "#1F0C10";
const HERO_GLOW = "#5A1C22";
const HERO_GOLD = "#E0B86A";
const HERO_TEXT = "#FFFFFF";
const HERO_TEXT_DIM = "rgba(255, 255, 255, 0.55)";
const HERO_WATERMARK = "rgba(255, 80, 90, 0.1)";
const HERO_PROGRESS_TRACK = "rgba(255, 255, 255, 0.1)";

// Each category card has its own colour family — picked to match the design
// mock. These are deliberately bright on purpose; they sit on the paper
// surface and need to "pop" without the theme accent stealing the show.
type CategoryTone = {
  surface: string; // page bg colour fills behind the card
  tile: string; // hanzi-tile bg
  hanzi: string; // hanzi-tile fg
  bar: string; // progress bar fill
  text: string; // percentage label
  watermark: string; // big watermark hanzi behind the card
};

const TONE_RED: CategoryTone = {
  surface: "#FAFAF7",
  tile: "#FCE4E6",
  hanzi: "#E63946",
  bar: "#E63946",
  text: "#E63946",
  watermark: "rgba(230, 57, 70, 0.07)",
};
const TONE_BLUE: CategoryTone = {
  surface: "#FAFAF7",
  tile: "#E0EAFF",
  hanzi: "#3B6FE0",
  bar: "#3B6FE0",
  text: "#3B6FE0",
  watermark: "rgba(59, 111, 224, 0.07)",
};
const TONE_PURPLE: CategoryTone = {
  surface: "#FAFAF7",
  tile: "#EBE2FB",
  hanzi: "#7A48D6",
  bar: "#7A48D6",
  text: "#7A48D6",
  watermark: "rgba(122, 72, 214, 0.07)",
};
const TONE_GREEN: CategoryTone = {
  surface: "#FAFAF7",
  tile: "#DCEEDB",
  hanzi: "#2E8B57",
  bar: "#2E8B57",
  text: "#2E8B57",
  watermark: "rgba(46, 139, 87, 0.07)",
};

// Each mini-exercise gets its own tile colour, lucide icon, short label and
// estimated duration. Keeping the meta data right here (rather than reading
// it from EXERCISE_META) lets us hand-pick colour pairings that match the
// design without polluting the rest of the codebase.
type MiniExerciseConfig = {
  type: ExerciseType;
  Icon: React.ComponentType<LucideProps>;
  tile: string;
  fg: string;
  /** i18n key (in `learn.*`) of the short marketing label — overrides the longer `exercises.types.<x>Label`. */
  labelKey: keyof Translations["learn"];
  /** i18n key (in `learn.*`) of the one-line teaser shown under the label. */
  hintKey: keyof Translations["learn"];
  minutes: number;
};

const MINI_EXERCISES_FALLBACK: ReadonlyArray<MiniExerciseConfig> = [
  {
    type: "translate",
    Icon: Repeat,
    tile: "#E0EAFF",
    fg: "#3B6FE0",
    labelKey: "miniTranslateLabel",
    hintKey: "miniTranslateHint",
    minutes: 3,
  },
  {
    type: "listen-and-pick",
    Icon: Headphones,
    tile: "#DCEEDB",
    fg: "#2E8B57",
    labelKey: "miniListenLabel",
    hintKey: "miniListenHint",
    minutes: 4,
  },
  {
    type: "match-pairs",
    Icon: Puzzle,
    tile: "#EBE2FB",
    fg: "#7A48D6",
    labelKey: "miniPairsLabel",
    hintKey: "miniPairsHint",
    minutes: 2,
  },
  {
    type: "tone-id",
    Icon: Music,
    tile: "#FCE4E6",
    fg: "#E63946",
    labelKey: "miniTonesLabel",
    hintKey: "miniTonesHint",
    minutes: 5,
  },
  // ▼ Temporarily disabled — on-device tone scorer (pitchfinder + heuristic
  //   classifier) is still confusing tones 3/4 in real-world use. Re-enable
  //   this tile once the classifier is tuned. The exercise type, runner case,
  //   card component, generator builder, and i18n strings all stay in place
  //   so flipping this entry back on is a one-line revival.
  // {
  //   type: "tone-pronounce",
  //   Icon: Mic,
  //   tile: "#D7F0F0",
  //   fg: "#0F8A8F",
  //   labelKey: "miniPronounceLabel",
  //   hintKey: "miniPronounceHint",
  //   minutes: 4,
  // },
  {
    type: "word-order",
    Icon: ListOrdered,
    tile: "#FFE6CC",
    fg: "#D97706",
    labelKey: "miniOrderLabel",
    hintKey: "miniOrderHint",
    minutes: 4,
  },
  {
    type: "fill-blank",
    Icon: MinusSquare,
    tile: "#FCE4E6",
    fg: "#E63946",
    labelKey: "miniBlankLabel",
    hintKey: "miniBlankHint",
    minutes: 3,
  },
];

// Curated anchor hanzi per topic id. The `hsk_topics.name.zh` column is
// `NULL` for every row, so we ship a hardcoded mapping rather than fall
// through to the emoji — designs call for a Chinese character, not an emoji
// picture inside the card.
const TOPIC_HANZI: Record<string, string> = {
  animals: "动",
  body_health: "体",
  clothing: "衣",
  colors: "色",
  communication: "话",
  emotions: "情",
  family: "家",
  food_drink: "食",
  hobbies: "趣",
  home: "屋",
  idioms: "成",
  money: "钱",
  nature: "自",
  numbers: "数",
  places: "地",
  politics: "政",
  school: "学",
  shopping: "购",
  sports: "运",
  technology: "技",
  time: "时",
  transport: "车",
  travel: "游",
  weather: "天",
  work: "工",
};

// Topic cards rotate through this palette so each one feels distinct without
// needing a per-topic theme in the DB. The surface tone is intentionally very
// pale — the colour anchor is the foreground hanzi, not the card body.
const TOPIC_TONES: ReadonlyArray<{ surface: string; hanzi: string; watermark: string }> = [
  { surface: "#FFFCFC", hanzi: "#E63946", watermark: "rgba(230, 57, 70, 0.12)" },
  { surface: "#FCFCFF", hanzi: "#3B6FE0", watermark: "rgba(59, 111, 224, 0.12)" },
  { surface: "#FBFDFB", hanzi: "#2E8B57", watermark: "rgba(46, 139, 87, 0.12)" },
  { surface: "#FDFCFE", hanzi: "#7A48D6", watermark: "rgba(122, 72, 214, 0.12)" },
  { surface: "#FFFDF9", hanzi: "#D97706", watermark: "rgba(217, 119, 6, 0.14)" },
];

export default function Learn() {
  const theme = useTheme();
  const t = useT();
  const data = useLearnData();
  const profile = useUserStore((s) => s.profile);
  const lang = profile?.native_language ?? "en";
  const userHsk = profile?.hsk_level ?? 1;

  const showContinue = data.dueCount > 0;
  const estimatedReviewMin = Math.max(1, Math.ceil(data.dueCount / 3));

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing["6xl"],
          gap: theme.spacing["2xl"],
        }}
      >
        {/* Top bar — eyebrow, big "Library" title, gear button */}
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
                  fontWeight: "700",
                  letterSpacing: 1.4,
                }}
              >
                {t.learn.section.toUpperCase()}
              </Text>
              <Text variant="caption" color="tertiary" chinese style={{ fontSize: 13 }}>
                · 学
              </Text>
            </View>
            <Text variant="h1" numberOfLines={1}>
              {t.learn.libraryTitle}
            </Text>
          </View>
          <SettingsButton onPress={() => router.push("/(app)/profile")} />
        </View>

        {/* Continue card (only when there's a due session to resume) */}
        {showContinue ? (
          <ContinueCard
            hanzi="复"
            label={t.learn.continueLabel}
            title={fmt(t.learn.continueReviewTitle, { n: data.dueCount })}
            subtitle={fmt(t.learn.continueReviewSubtitle, { n: estimatedReviewMin })}
            progress={data.deckTotal > 0 ? Math.min(1, data.masteredWords / data.deckTotal) : 0}
            onPress={() => router.push("/(app)/vocab/review")}
          />
        ) : null}

        {/* SECTIONS */}
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeader
            label={t.learn.sectionsLabel}
            trailing={fmt(t.learn.sectionsCount, { n: 4 })}
          />

          {data.loading ? (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <Skeleton height={170} radius="lg" style={{ flex: 1 }} />
                <Skeleton height={170} radius="lg" style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <Skeleton height={170} radius="lg" style={{ flex: 1 }} />
                <Skeleton height={170} radius="lg" style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <CategoryCard
                  hanzi="词"
                  tone={TONE_RED}
                  title={t.learn.catWords}
                  subtitle={fmt(t.learn.catWordsSub, {
                    deck: data.deckTotal,
                    due: data.dueCount,
                  })}
                  progress={
                    data.deckTotal > 0 ? data.masteredWords / data.deckTotal : 0
                  }
                  badge={data.dueCount > 0 ? fmt(t.learn.badgeDue, { n: data.dueCount }) : null}
                  badgeVariant="danger"
                  onPress={() => router.push("/(app)/vocab/browse")}
                />
                <CategoryCard
                  hanzi="级"
                  tone={TONE_BLUE}
                  title={t.learn.catHsk}
                  subtitle={t.learn.catHskSub}
                  progress={data.hskCovered / data.hskTotalWords}
                  onPress={() => router.push("/(app)/hsk")}
                />
              </View>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <CategoryCard
                  hanzi="字"
                  tone={TONE_PURPLE}
                  title={t.learn.catChars}
                  subtitle={
                    data.charactersMastered + data.charactersLearning > 0
                      ? fmt(t.learn.catCharsSub, {
                          mastered: data.charactersMastered,
                          learning: data.charactersLearning,
                        })
                      : t.learn.catCharsSubEmpty
                  }
                  progress={
                    data.charactersTotal > 0
                      ? data.charactersMastered / data.charactersTotal
                      : 0
                  }
                  onPress={() => router.push("/(app)/character")}
                />
                <CategoryCard
                  hanzi="法"
                  tone={TONE_GREEN}
                  title={t.learn.catGrammar}
                  subtitle={fmt(t.learn.catGrammarSub, { n: data.grammarPatternsTotal })}
                  progress={
                    data.grammarPatternsTotal > 0
                      ? data.grammarPatternsCompleted / data.grammarPatternsTotal
                      : 0
                  }
                  badge={t.learn.badgeNew}
                  badgeVariant="success"
                  onPress={() => router.push("/(app)/grammar")}
                />
              </View>
            </View>
          )}
        </View>

        {/* MINI EXERCISES — 3-column grid (3×2). Each tile shows an icon
            in a coloured square, a minutes badge in the top-right corner,
            and a label + hint underneath, mirroring the design mockup. */}
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeader
            label={t.learn.miniExercises}
            trailing={t.learn.miniExercisesDuration}
            action={{
              icon: <Dices color={theme.colors.textPrimary} size={14} strokeWidth={2.2} />,
              label: t.learn.miniExercisesRandom,
              onPress: () => router.push("/(app)/exercises/random"),
            }}
          />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              // Negative horizontal margin trick — children use a fixed gap
              // and `flexBasis: 33.33%` to get exactly 3 columns regardless
              // of the parent's padding.
              gap: theme.spacing.sm,
            }}
          >
            {MINI_EXERCISES_FALLBACK.map((mx) => (
              <MiniExerciseTile
                key={mx.type}
                config={mx}
                onPress={() => router.push(`/(app)/exercises/${mx.type}` as never)}
              />
            ))}
          </View>
        </View>

        {/* BY TOPIC — horizontal scroll of poster cards, each with a giant
            colored hanzi watermark and a word-count subtitle. */}
        {data.topTopics.length > 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            <SectionHeader
              label={t.learn.topicsLabel}
              trailing={undefined}
              action={{
                icon: (
                  <ChevronRight
                    color={theme.colors.textPrimary}
                    size={14}
                    strokeWidth={2.2}
                  />
                ),
                label: t.learn.topicsViewAll,
                onPress: () => router.push("/(app)/hsk"),
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: theme.spacing.sm,
                paddingRight: theme.spacing.lg,
              }}
            >
              {data.topTopics.map((topic, idx) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  tone={TOPIC_TONES[idx % TOPIC_TONES.length]!}
                  lang={lang}
                  wordCountLabel={fmt(t.learn.topicWords, { n: topic.word_count ?? 0 })}
                  onPress={() => router.push(`/(app)/hsk/topic/${topic.id}` as never)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* DAILY CHALLENGE — gold promo card pinned at the bottom of the tab.
            Tapping routes to the character training screen for a quick HSK
            recognition session. */}
        <DailyChallengeCard
          title={fmt(t.learn.challengeTitle, { xp: 25 })}
          subtitle={fmt(t.learn.challengeSubtitle, { hsk: userHsk })}
          onPress={() => router.push("/(app)/character")}
        />
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header — small red bar + caps label + a trailing slot on the right
// (count + optional action button). Mirrors the rhythm used on the Home tab.
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({
  label,
  trailing,
  action,
}: {
  label: string;
  trailing?: string;
  action?: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
  };
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
          fontSize: 15,
          fontWeight: "800",
          letterSpacing: 1.4,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <View style={{ flex: 1 }} />
      {trailing ? (
        <Text variant="small" color="tertiary">
          {trailing}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {action.icon}
          <Text variant="small" color="primary" style={{ fontWeight: "600" }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Continue card — same dark-burgundy poster style as the Home hero, but laid
// out horizontally so it occupies less vertical real-estate. The user's
// in-progress task (review most often) gets pride of place at the top.
// ─────────────────────────────────────────────────────────────────────────────
function ContinueCard({
  hanzi,
  label,
  title,
  subtitle,
  progress,
  onPress,
}: {
  hanzi: string;
  label: string;
  title: string;
  subtitle: string;
  progress: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        backgroundColor: HERO_BG,
        borderRadius: theme.radii.xl,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        overflow: "hidden",
        opacity: pressed ? 0.95 : 1,
        ...theme.shadows.md,
        shadowColor: "#000",
        shadowOpacity: 0.16,
      })}
    >
      {/* Glow + watermark layers, matching the Home hero treatment. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="continueGlow" cx="80%" cy="40%" r="70%">
              <Stop offset="0%" stopColor={HERO_GLOW} stopOpacity={0.9} />
              <Stop offset="60%" stopColor={HERO_GLOW} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={HERO_GLOW} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill="url(#continueGlow)" />
        </Svg>
      </View>
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -40,
          bottom: -60,
          fontSize: 240,
          lineHeight: 240,
          fontWeight: "900",
          color: HERO_WATERMARK,
        }}
      >
        续
      </Text>

      {/* Row: hanzi tile + title block + play button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: theme.radii.md,
            backgroundColor: "#5C1F26",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            chinese
            style={{
              color: HERO_TEXT,
              fontSize: 30,
              lineHeight: 36,
              fontWeight: "800",
            }}
          >
            {hanzi}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: HERO_GOLD,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 1.4,
              fontWeight: "700",
            }}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: HERO_TEXT,
              fontSize: 17,
              lineHeight: 22,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: HERO_TEXT_DIM,
              fontSize: 13,
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: theme.colors.accent,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: theme.colors.accent,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Play color={HERO_TEXT} size={22} strokeWidth={2.5} fill={HERO_TEXT} />
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: HERO_PROGRESS_TRACK,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${clamped * 100}%`,
            height: "100%",
            backgroundColor: theme.colors.accent,
            borderRadius: 2,
          }}
        />
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category card — colourful hanzi tile + title + subtitle + progress + label.
// One per major area of the app. Tones are picked per-card to give the grid
// visual rhythm; the watermark hanzi behind each card is the same character
// as the foreground tile so the card reads as a poster for that section.
// ─────────────────────────────────────────────────────────────────────────────
function CategoryCard({
  hanzi,
  tone,
  title,
  subtitle,
  progress,
  badge,
  badgeVariant,
  onPress,
}: {
  hanzi: string;
  tone: CategoryTone;
  title: string;
  subtitle: string;
  progress: number;
  badge?: string | null;
  badgeVariant?: "danger" | "success";
  onPress: () => void;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = Math.round(clamped * 100);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.md,
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? 0.92 : 1,
        overflow: "hidden",
        minHeight: 168,
      })}
    >
      {/* Big watermark hanzi behind everything — same character as the tile
          so each card visually "owns" its hanzi. Pinned to bottom-right. */}
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
          color: tone.watermark,
        }}
      >
        {hanzi}
      </Text>

      {/* Top row: hanzi tile + optional badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: theme.radii.md,
            backgroundColor: tone.tile,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            chinese
            style={{
              color: tone.hanzi,
              fontSize: 26,
              lineHeight: 30,
              fontWeight: "800",
            }}
          >
            {hanzi}
          </Text>
        </View>

        {badge ? <CategoryBadge label={badge} variant={badgeVariant ?? "danger"} /> : null}
      </View>

      <View style={{ gap: 2, marginTop: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: 17,
            lineHeight: 22,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <Text variant="small" color="secondary" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      {/* Progress bar + percentage label */}
      <View style={{ marginTop: "auto", gap: 4 }}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.colors.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: tone.bar,
              borderRadius: 2,
            }}
          />
        </View>
        <Text
          style={{
            color: tone.text,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: "700",
          }}
        >
          {pct}%
        </Text>
      </View>
    </Pressable>
  );
}

function CategoryBadge({
  label,
  variant,
}: {
  label: string;
  variant: "danger" | "success";
}) {
  if (variant === "success") {
    // NEW-style badge — outlined green pill.
    return (
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: "#2E8B57",
          backgroundColor: "transparent",
        }}
      >
        <Text
          style={{
            color: "#2E8B57",
            fontSize: 11,
            lineHeight: 14,
            fontWeight: "800",
            letterSpacing: 0.4,
          }}
        >
          {label}
        </Text>
      </View>
    );
  }
  // Danger badge — solid red pill (e.g. "8 due").
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: "#E63946",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 11,
          lineHeight: 14,
          fontWeight: "800",
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini-exercise tile — used in a 3×2 grid. Coloured icon square at the top
// (with a minutes badge in its top-right corner), then a bold label and a
// short hint underneath. Width is 31% so three tiles fit on a row with the
// row's `gap` taking care of the spacing.
// ─────────────────────────────────────────────────────────────────────────────
function MiniExerciseTile({
  config,
  onPress,
}: {
  config: MiniExerciseConfig;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const label = t.learn[config.labelKey];
  const hint = t.learn[config.hintKey];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        // 31% lets three tiles sit on one row with a small gap between.
        width: "31%",
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.sm,
        gap: 6,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: "100%",
          // Slightly taller-than-square works better with the lucide-style
          // icons — gives the tile a softer cell silhouette to match the
          // design mockup (icons stay centered with breathing room above
          // and below).
          height: 78,
          borderRadius: theme.radii.md,
          backgroundColor: config.tile,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <config.Icon color={config.fg} size={30} strokeWidth={2.4} />
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 8,
            backgroundColor: "rgba(255, 255, 255, 0.85)",
          }}
        >
          <Text
            style={{
              color: config.fg,
              fontSize: 10,
              lineHeight: 12,
              fontWeight: "800",
            }}
          >
            {fmt(t.learn.miniExerciseMinutes, { n: config.minutes })}
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 2, gap: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
        <Text variant="caption" color="tertiary" numberOfLines={1} style={{ letterSpacing: 0 }}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Topic card — poster-style horizontal-scroll tile with a huge translucent
// hanzi watermark behind the foreground label. The hanzi shown is the first
// Chinese character of the topic's zh name (e.g. "食物" → "食"), so it stays
// data-driven even though the visual treatment is identical for every card.
// ─────────────────────────────────────────────────────────────────────────────
function TopicCard({
  topic,
  tone,
  lang,
  wordCountLabel,
  onPress,
}: {
  topic: Topic;
  tone: { surface: string; hanzi: string; watermark: string };
  lang: string;
  wordCountLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const label =
    topic.name[lang] ??
    topic.name.en ??
    Object.values(topic.name)[0] ??
    topic.id;
  // Curated map first (covers every topic shipped today), then first hanzi of
  // the zh name if it ever gets populated, then a generic "类" placeholder.
  const zh = topic.name.zh ?? topic.name["zh-CN"] ?? "";
  const anchorHanzi =
    TOPIC_HANZI[topic.id] ??
    (zh.length > 0 ? Array.from(zh)[0]! : null) ??
    "类";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 138,
        height: 168,
        borderRadius: theme.radii.lg,
        backgroundColor: tone.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.md,
        overflow: "hidden",
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {/* Big watermark hanzi — same character as the anchor, painted at low
          opacity and spilling out the bottom-right edge. Sits behind both
          the foreground hanzi and the label so it reads as a stamped poster. */}
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -22,
          bottom: -36,
          fontSize: 150,
          lineHeight: 150,
          fontWeight: "900",
          color: tone.watermark,
        }}
      >
        {anchorHanzi}
      </Text>

      {/* Foreground anchor hanzi — top-left, in the topic colour. This is the
          "logo" of the topic; the watermark below is its echo. */}
      <Text
        chinese
        pointerEvents="none"
        style={{
          fontSize: 56,
          lineHeight: 64,
          fontWeight: "800",
          color: tone.hanzi,
        }}
      >
        {anchorHanzi}
      </Text>

      <View style={{ marginTop: "auto", gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
        <Text variant="caption" color="tertiary" numberOfLines={1} style={{ letterSpacing: 0 }}>
          {wordCountLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily challenge — gold-tinted promo banner that sits at the bottom of the
// Learn tab. A short, time-boxed activity is a useful nudge to come back
// after the main sections are explored.
// ─────────────────────────────────────────────────────────────────────────────
function DailyChallengeCard({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        backgroundColor: "#FBF3DF",
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: "#E8D08A",
        padding: theme.spacing.md,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "#E8B84A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Zap color="#FFFFFF" size={20} strokeWidth={2.4} fill="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: "#7A5500",
            fontSize: 14,
            lineHeight: 18,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            color: "#9B7A30",
            fontSize: 12,
            lineHeight: 16,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <ChevronRight color="#9B7A30" size={18} strokeWidth={2.2} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings button — small bordered tile with a gear, sits where the design
// shows the top-right circular icon button.
// ─────────────────────────────────────────────────────────────────────────────
function SettingsButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      onPress={onPress}
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
      <SettingsIcon color={theme.colors.textPrimary} size={20} strokeWidth={2} />
    </Pressable>
  );
}
