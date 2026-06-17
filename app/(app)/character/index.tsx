import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  Play,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Screen, Text } from "@/components/ui";
import { fetchTodayActivity } from "@/features/activity/activity";
import {
  fetchDict,
  fetchUserCharacters,
  joinWithProgress,
  type CharacterWithProgress,
} from "@/features/character/character";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Filter = "all" | "learning" | "mastered" | "new";

const HSK_LEVELS = [1, 2, 3, 4, 5, 6] as const;
type HskLevel = (typeof HSK_LEVELS)[number];

// Brand palette pulled from the design HTMLs — kept inline so the screen is
// pixel-traceable against mock 19 without hopping files.
const C_PAPER = "#FAFAF7";
const C_SURFACE = "#FFFFFF";
const C_WARM = "#F5F1EA";
const C_BORDER = "#ECE7DE";
const C_INK = "#1A1614";
const C_INK_2 = "#524A42";
const C_INK_3 = "#8A847C";
const C_RED = "#E63946";
const C_RED_DEEP = "#C8102E";
const C_RED_100 = "#FFE2E4";
const C_GOLD = "#E0B86A";
const C_GREEN = "#1F8A5B";
const C_AMBER_TILE = "#FEF3D9";
const C_AMBER_INK = "#A85B00";

// Dark "poster" card colours — match the Home hero + Grammar Personal card so
// every dark CTA in the app reads as the same surface family.
const HERO_BG = "#1F0C10";
const HERO_GLOW = "#5A1C22";
const RED_AVATAR_TILE = "#5C1F26";

export default function CharacterRoadmap() {
  const theme = useTheme();
  const t = useT();
  const { width: screenW } = useWindowDimensions();
  const session = useUserStore((s) => s.session);

  const [loading, setLoading] = useState(true);
  const [chars, setChars] = useState<CharacterWithProgress[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [hskLevel, setHskLevel] = useState<HskLevel>(1);
  const [todayLearned, setTodayLearned] = useState(0);

  // Re-fetch the dict whenever the HSK level changes. User progress is
  // unaffected by level — we still join against every saved row, which
  // keeps progress badges consistent if the user opens HSK 2 having
  // already mastered some HSK 1 characters earlier.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [dict, prog, today] = await Promise.all([
        fetchDict(hskLevel),
        fetchUserCharacters(session.user.id),
        fetchTodayActivity(session.user.id),
      ]);
      if (cancelled) return;
      setChars(joinWithProgress(dict, prog));
      setTodayLearned(today?.characters_learned ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, hskLevel]);

  // Per-status buckets used for the stats row + filter chip counts. Computed
  // off `chars` so every status pill shows the correct count for the current
  // HSK cohort, regardless of the active filter.
  const totals = useMemo(() => {
    const acc = { total: chars.length, new: 0, learning: 0, mastered: 0 };
    for (const c of chars) {
      const step = c.progress?.step_completed ?? 0;
      if (step === 0) acc.new += 1;
      else if (step >= 5) acc.mastered += 1;
      else acc.learning += 1;
    }
    return acc;
  }, [chars]);

  // "Recommended next" character — first not-yet-mastered glyph in
  // frequency-rank order. Used both by the hero card up top and by the
  // "NEXT" badge in the grid. Falls back to the first character if the
  // user has already mastered everything in this HSK cohort.
  const nextChar = useMemo<CharacterWithProgress | null>(() => {
    const candidate = chars.find(
      (c) => (c.progress?.step_completed ?? 0) < 5,
    );
    return candidate ?? chars[0] ?? null;
  }, [chars]);

  const filtered = useMemo(() => {
    const subset = chars.filter((c) => {
      const step = c.progress?.step_completed ?? 0;
      switch (filter) {
        case "new":
          return step === 0;
        case "learning":
          return step > 0 && step < 5;
        case "mastered":
          return step >= 5;
        default:
          return true;
      }
    });
    // Sort by the first pinyin reading, alphabetically. localeCompare with
    // "zh" handles diacritics sensibly (ā < á < ǎ < à within the same root)
    // and base letters sort A→Z as expected. Falls back to hanzi when the
    // pinyin is missing so the row order stays deterministic.
    return [...subset].sort((a, b) => {
      const aPy = a.pinyin[0] ?? "";
      const bPy = b.pinyin[0] ?? "";
      const cmp = aPy.localeCompare(bPy, "zh");
      if (cmp !== 0) return cmp;
      return a.hanzi.localeCompare(b.hanzi);
    });
  }, [chars, filter]);

  // Next round-number milestone for mastered count — drives the
  // "До следующего рубежа — N иероглифа" copy in the tip strip. We round to
  // the next multiple of 10 (so 27 mastered → next target 30 → remaining 3).
  const nextMilestone = useMemo(() => {
    const m = totals.mastered;
    const step = m < 50 ? 10 : 25;
    const target = Math.max(step, Math.ceil((m + 1) / step) * step);
    return { target, remaining: target - m };
  }, [totals.mastered]);

  // Compact grid — pack 5 cells per row regardless of phone width. Computing
  // an exact cell width keeps the layout grid-perfect instead of relying on
  // flex-basis percentages (which round inconsistently across devices).
  const GRID_PAD = 16;
  const GRID_GAP = 6;
  const GRID_COLS = 5;
  const cellW = Math.max(
    44,
    Math.floor((screenW - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS),
  );

  function openChar(hanzi: string) {
    router.push(`/(app)/character/${encodeURIComponent(hanzi)}`);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["6xl"],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar — back + eyebrow/title + settings */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.replace("/(app)/learn")}
            hitSlop={12}
            accessibilityLabel={t.common.back}
            style={{ padding: 4 }}
          >
            <ArrowLeft color={C_INK} size={22} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text
              chinese
              style={{
                color: C_RED,
                fontSize: 11,
                lineHeight: 14,
                letterSpacing: 1.4,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.character.mapEyebrow}
            </Text>
            <Text
              style={{
                color: C_INK,
                fontSize: 22,
                lineHeight: 26,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.character.listTitle}
            </Text>
          </View>
          <Pressable
            hitSlop={12}
            accessibilityLabel={t.common.settings}
            onPress={() => router.push("/(app)/profile")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: C_WARM,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SettingsIcon color={C_INK_2} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Next-character hero — dark poster card */}
        {nextChar ? (
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <NextCharHero
              char={nextChar}
              onPress={() => openChar(nextChar.hanzi)}
            />
          </View>
        ) : null}

        {/* Stats row — 3 flat tiles */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            flexDirection: "row",
            gap: theme.spacing.sm,
          }}
        >
          <StatTile label={t.character.statTotal} value={totals.total} color={C_INK} />
          <StatTile
            label={t.character.statLearning}
            value={totals.learning}
            color={C_AMBER_INK}
          />
          <StatTile
            label={t.character.statMastered}
            value={totals.mastered}
            color={C_GREEN}
          />
        </View>

        {/* HSK level pills (dark-active) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            gap: 8,
          }}
        >
          {HSK_LEVELS.map((lvl) => (
            <Pill
              key={lvl}
              label={`HSK ${lvl}`}
              active={hskLevel === lvl}
              variant="dark"
              onPress={() => setHskLevel(lvl)}
            />
          ))}
        </ScrollView>

        {/* Status filter pills (light-red-active, with counts) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            gap: 8,
          }}
        >
          <Pill
            label={`${t.character.filterAll} · ${totals.total}`}
            active={filter === "all"}
            variant="soft"
            onPress={() => setFilter("all")}
          />
          <Pill
            label={`${t.character.filterNew} · ${totals.new}`}
            active={filter === "new"}
            variant="soft"
            onPress={() => setFilter("new")}
          />
          <Pill
            label={`${t.character.filterLearning} · ${totals.learning}`}
            active={filter === "learning"}
            variant="soft"
            onPress={() => setFilter("learning")}
          />
          <Pill
            label={`${t.character.filterMastered} · ${totals.mastered}`}
            active={filter === "mastered"}
            variant="soft"
            icon={
              filter === "mastered" ? (
                <Check color={C_RED_DEEP} size={12} strokeWidth={3} />
              ) : null
            }
            onPress={() => setFilter("mastered")}
          />
        </ScrollView>

        {/* Milestone tip strip */}
        {todayLearned > 0 || nextMilestone.remaining > 0 ? (
          <View
            style={{
              marginTop: theme.spacing.md,
              marginHorizontal: theme.spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: C_AMBER_TILE,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Zap
              color={C_AMBER_INK}
              size={14}
              strokeWidth={2.4}
              fill={C_AMBER_INK}
            />
            <Text
              style={{
                color: C_AMBER_INK,
                fontSize: 12,
                lineHeight: 16,
                fontFamily: theme.fonts.uiSemiBold,
                flex: 1,
              }}
            >
              {todayLearned > 0 ? fmt(t.character.todayMastered, { n: todayLearned }) : ""}
              {nextMilestone.remaining > 0
                ? fmt(
                    nextMilestone.remaining === 1
                      ? t.character.milestoneToGoOne
                      : t.character.milestoneToGoOther,
                    { n: nextMilestone.remaining },
                  )
                : t.character.milestoneReached}
            </Text>
          </View>
        ) : null}

        {/* Grid */}
        {loading ? (
          <View
            style={{
              paddingVertical: theme.spacing["3xl"],
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={C_RED} />
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: GRID_PAD,
              paddingTop: theme.spacing.md,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: GRID_GAP,
            }}
          >
            {filtered.map((c) => (
              <CharCell
                key={c.hanzi}
                char={c}
                size={cellW}
                isNext={!!nextChar && c.hanzi === nextChar.hanzi}
                onPress={() => openChar(c.hanzi)}
              />
            ))}
            {filtered.length === 0 ? (
              <Text
                style={{
                  width: "100%",
                  textAlign: "center",
                  color: C_INK_3,
                  paddingVertical: theme.spacing["2xl"],
                }}
              >
                {t.character.emptyState}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function NextCharHero({
  char,
  onPress,
}: {
  char: CharacterWithProgress;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const meaning = char.meanings[0] ?? "";
  const strokes = char.stroke_count ?? null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fmt(t.character.nextCharA11y, { hanzi: char.hanzi })}
      style={({ pressed }) => ({
        backgroundColor: HERO_BG,
        borderRadius: 16,
        padding: 14,
        overflow: "hidden",
        opacity: pressed ? 0.95 : 1,
        ...theme.shadows.md,
        shadowColor: "#000",
        shadowOpacity: 0.16,
      })}
    >
      {/* Glow + watermark backdrop */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <Defs>
            <RadialGradient id="charGlow" cx="82%" cy="42%" r="70%">
              <Stop offset="0%" stopColor={HERO_GLOW} stopOpacity={0.85} />
              <Stop offset="60%" stopColor={HERO_GLOW} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={HERO_GLOW} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill="url(#charGlow)" />
        </Svg>
      </View>
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -32,
          bottom: -60,
          fontSize: 200,
          lineHeight: 200,
          fontWeight: "900",
          color: "rgba(255, 80, 90, 0.08)",
          fontFamily: theme.fonts.chineseSerifBlack,
        }}
      >
        {char.hanzi}
      </Text>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            backgroundColor: RED_AVATAR_TILE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            chinese
            style={{
              color: C_RED,
              fontSize: 30,
              lineHeight: 34,
              fontFamily: theme.fonts.chineseSerifBlack,
            }}
          >
            {char.hanzi}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: C_GOLD,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 1.4,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.character.nextCharLabel}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text
              chinese
              style={{
                color: "#FFFFFF",
                fontSize: 18,
                lineHeight: 22,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {char.hanzi}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 13,
                lineHeight: 18,
                fontFamily: theme.fonts.pinyinMono,
              }}
            >
              {char.pinyin[0] ?? ""}
            </Text>
          </View>
          <Text
            numberOfLines={2}
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            «{meaning}»
            {strokes != null
              ? ` · ${fmt(strokes === 1 ? t.character.strokesCountOne : t.character.strokesCountOther, { n: strokes })}`
              : ""}
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: C_RED,
            alignItems: "center",
            justifyContent: "center",
            ...theme.shadows.sm,
            shadowColor: C_RED,
            shadowOpacity: 0.3,
          }}
        >
          <Play color="#FFFFFF" size={18} strokeWidth={2.4} fill="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: C_SURFACE,
        borderWidth: 1,
        borderColor: C_BORDER,
        gap: 2,
      }}
    >
      <Text
        style={{
          color,
          fontSize: 22,
          lineHeight: 26,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: C_INK_3,
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 1.2,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function Pill({
  label,
  active,
  variant,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  variant: "dark" | "soft";
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  const palette =
    variant === "dark"
      ? {
          bgActive: C_INK,
          fgActive: "#FFFFFF",
          bgInactive: C_SURFACE,
          fgInactive: C_INK,
          borderInactive: C_BORDER,
        }
      : {
          bgActive: C_RED_100,
          fgActive: C_RED_DEEP,
          bgInactive: C_SURFACE,
          fgInactive: C_INK_2,
          borderInactive: C_BORDER,
        };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? palette.bgActive : palette.bgInactive,
        borderWidth: active ? 0 : 1,
        borderColor: palette.borderInactive,
      }}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={{
          color: active ? palette.fgActive : palette.fgInactive,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Compact character tile — hanzi + pinyin + corner status badge. The "NEXT"
 * banner replaces the corner badge on the recommended-next glyph so the
 * grid always has one clear "start here" affordance even for first-time
 * users with zero progress on every tile.
 */
function CharCell({
  char,
  size,
  isNext,
  onPress,
}: {
  char: CharacterWithProgress;
  size: number;
  isNext: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const step = char.progress?.step_completed ?? 0;
  const isMastered = step >= 5;
  const isLearning = step > 0 && step < 5;

  // Filled (mastered/learning) tiles use the warm beige; new tiles stay
  // white so the eye picks out untouched glyphs at a glance. NEXT overrides
  // both with a soft red wash to mark the recommended next step.
  const bg = isNext ? C_RED_100 : isMastered || isLearning ? C_WARM : C_SURFACE;
  const borderColor = isNext ? C_RED_100 : C_BORDER;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${char.hanzi} — ${char.pinyin[0] ?? ""}`}
      style={{
        width: size,
        height: size + 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Corner status badge (mastered = green ✓, learning = orange N/5) */}
      {isMastered ? (
        <View
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: C_GREEN,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check color="#FFFFFF" size={9} strokeWidth={3.4} />
        </View>
      ) : isLearning ? (
        <View
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: 5,
            backgroundColor: "#FFFFFF",
          }}
        >
          <Text
            style={{
              color: C_AMBER_INK,
              fontSize: 8,
              lineHeight: 10,
              fontFamily: theme.fonts.uiBold,
              letterSpacing: 0.2,
            }}
          >
            {step}/5
          </Text>
        </View>
      ) : null}

      {/* NEXT banner — pinned to the top edge of the recommended tile */}
      {isNext ? (
        <View
          style={{
            position: "absolute",
            top: -8,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 4,
            backgroundColor: C_RED,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 8,
              lineHeight: 11,
              fontFamily: theme.fonts.uiBold,
              letterSpacing: 0.6,
            }}
          >
            NEXT
          </Text>
        </View>
      ) : null}

      <Text
        chinese
        numberOfLines={1}
        style={{
          color: C_INK,
          fontSize: Math.round(size * 0.46),
          lineHeight: Math.round(size * 0.52),
          fontFamily: theme.fonts.chineseSerif,
        }}
      >
        {char.hanzi}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: C_INK_3,
          fontSize: 10,
          lineHeight: 12,
          marginTop: 2,
          fontFamily: theme.fonts.pinyinMono,
        }}
      >
        {char.pinyin[0] ?? ""}
      </Text>
    </Pressable>
  );
}

