import { router } from "expo-router";
import { ArrowLeft, Check, ChevronRight, Dices, User } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Screen, Text } from "@/components/ui";
import {
  ALL_GRAMMAR_LEVELS,
  availableLexicalLevels,
  constructionName,
  defaultLexicalLevelFor,
  listConstructions,
  type Construction,
  type GrammarLevel,
  type LexicalLevel,
} from "@/features/grammar/patterns";
import { useHydratedPersonalDeck } from "@/features/grammar/personal";
import { useHydratedTrainerSettings } from "@/features/grammar/store";
import { useLang, useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

// ─────────────────────────────────────────────────────────────────────────────
// The grammar picker re-uses the ink-stamp poster motif (dark burgundy, gold
// eyebrow, hanzi watermark) on the "My collection" card, so it slots into the
// same visual family as the Home hero and Learn continue card.
// ─────────────────────────────────────────────────────────────────────────────
const HERO_BG = "#1F0C10";
const HERO_GLOW = "#5A1C22";
const HERO_GOLD = "#E0B86A";
const HERO_TEXT = "#FFFFFF";
const HERO_TEXT_DIM = "rgba(255, 255, 255, 0.55)";
const HERO_WATERMARK = "rgba(255, 80, 90, 0.1)";
const RED_AVATAR_TILE = "#5C1F26";

// Selected grammar-level card uses the same poster bg so the selection state
// reads as "this is the active one" without resorting to the brand accent.
const GRAMMAR_CARD_DARK = "#1F0C10";

// Approximate HSK syllabus word counts per cumulative scope. Hard-coded since
// they're stable (the syllabus is a fixed reference; we display them for
// orientation only, not for any calculation).
const HSK_WORD_TOTAL: Record<LexicalLevel, number> = {
  1: 150,
  2: 301,
  3: 600,
  4: 1200,
  5: 2500,
  6: 5000,
};

// Memo-friendly per-grammar-level construction count. Computed at module load.
const GRAMMAR_TOTAL: Record<GrammarLevel, number> = {
  1: countConstructions(1),
  2: countConstructions(2),
  3: countConstructions(3),
};

// Cycled palette for construction-tile hanzi swatches. Same vocabulary of
// pastel tile + saturated foreground as the Learn screen's mini-exercises and
// topic cards, so the page reads as one design system.
const CONSTRUCTION_TONES: ReadonlyArray<{ tile: string; fg: string }> = [
  { tile: "#FCE4E6", fg: "#E63946" }, // red
  { tile: "#E0EAFF", fg: "#3B6FE0" }, // blue
  { tile: "#DCEEDB", fg: "#2E8B57" }, // green
  { tile: "#EBE2FB", fg: "#7A48D6" }, // purple
  { tile: "#FFE6CC", fg: "#D97706" }, // amber
];

function countConstructions(g: GrammarLevel): number {
  const lvls = availableLexicalLevels(g);
  if (lvls.length === 0) return 0;
  return listConstructions(g, lvls[0]!).length;
}

function formatWordCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export default function GrammarIndex() {
  const theme = useTheme();
  const t = useT();
  const lang = useLang();
  const settings = useHydratedTrainerSettings();
  const { grammarLevel, level, setGrammarLevel, setLevel, hydrated } = settings;
  const personal = useHydratedPersonalDeck();
  const personalCount = personal.constructions.length;
  const personalPhrases = personal.constructions.reduce(
    (s, c) => s + c.patterns.length,
    0,
  );

  // Keep lexical level valid for the picked grammar level. Persisted "level=4"
  // doesn't make sense when the user flips to HSK 1 grammar (which only ships
  // 1..6 — fine) or HSK 3 grammar (which starts at 3). Snap to the smallest.
  const lexicalChoices = useMemo(
    () => availableLexicalLevels(grammarLevel),
    [grammarLevel],
  );
  useEffect(() => {
    if (!hydrated) return;
    if (!lexicalChoices.includes(level)) {
      setLevel(defaultLexicalLevelFor(grammarLevel));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grammarLevel, hydrated]);

  const constructions = useMemo<Construction[]>(
    () => (hydrated ? listConstructions(grammarLevel, level) : []),
    [grammarLevel, level, hydrated],
  );

  function openConstruction(id: number) {
    router.push(
      `/(app)/grammar/${id}?grammar=${grammarLevel}&level=${level}` as never,
    );
  }

  function startRandomSprint() {
    if (!hydrated) return;
    if (constructions.length === 0) return;
    const pick = constructions[Math.floor(Math.random() * constructions.length)]!;
    openConstruction(pick.id);
  }

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
        {/* Top bar — circular back + circular dice quick-start */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <CircleIconButton
            label={t.common.back}
            // Tabs with hidden screens lose the previous-tab in history, so
            // `router.back()` lands on Home rather than Learn. Replace with
            // Learn explicitly — the natural parent of every library section.
            onPress={() => router.replace("/(app)/learn")}
          >
            <ArrowLeft color={theme.colors.textPrimary} size={20} strokeWidth={2.2} />
          </CircleIconButton>
          <CircleIconButton label={t.grammarHub.randomSprintA11y} onPress={startRandomSprint}>
            <Dices color={theme.colors.textPrimary} size={20} strokeWidth={2.2} />
          </CircleIconButton>
        </View>

        {/* Eyebrow + big title + lead paragraph */}
        <View style={{ gap: theme.spacing.md }}>
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
              {t.grammarHub.eyebrow}
            </Text>
            <Text variant="caption" color="tertiary" chinese style={{ fontSize: 13 }}>
              · 法
            </Text>
          </View>
          <Text variant="h1" style={{ fontSize: 36, lineHeight: 40 }}>
            {t.grammarHub.title}
          </Text>
          <Text variant="body" color="secondary">
            {t.grammarHub.lead}
          </Text>
        </View>

        {/* My collection — dark poster card */}
        <PersonalCollectionCard
          count={personalCount}
          phrases={personalPhrases}
          onPress={() => router.push("/(app)/grammar/personal")}
        />

        {/* Grammar level */}
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeader
            label={t.grammarHub.grammarLevelLabel}
            trailing={fmt(t.grammarHub.constructionsTrailing, {
              done: GRAMMAR_TOTAL[grammarLevel],
              total: GRAMMAR_TOTAL[grammarLevel],
            })}
          />
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            {ALL_GRAMMAR_LEVELS.map((g) => (
              <GrammarLevelCard
                key={g}
                level={g}
                total={GRAMMAR_TOTAL[g] || 0}
                completed={0}
                active={g === grammarLevel}
                isNew={g === 3}
                onPress={() => setGrammarLevel(g)}
              />
            ))}
          </View>
        </View>

        {/* Lexical level */}
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeader label={t.grammarHub.lexicalLevelLabel} />
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
              padding: theme.spacing.md,
            }}
          >
            <Text variant="body" color="primary">
              {t.grammarHub.lexicalPrefix}
              <Text variant="bodyStrong">HSK {grammarLevel}</Text>
              {t.grammarHub.lexicalMiddle}
              <Text variant="bodyStrong">
                HSK {grammarLevel === level ? level : `${grammarLevel}–${level}`}
              </Text>
              {fmt(t.grammarHub.lexicalSuffix, {
                n: HSK_WORD_TOTAL[level].toLocaleString(lang),
              })}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.spacing.sm,
              paddingRight: theme.spacing.lg,
            }}
          >
            {lexicalChoices.map((lvl) => (
              <LexicalLevelPill
                key={lvl}
                grammarLevel={grammarLevel}
                level={lvl}
                wordCount={HSK_WORD_TOTAL[lvl]}
                active={lvl === level}
                onPress={() => setLevel(lvl)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Random sprint CTA */}
        <Pressable
          onPress={startRandomSprint}
          accessibilityRole="button"
          accessibilityLabel={t.grammarHub.randomSprint}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.sm,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radii.lg,
            paddingVertical: theme.spacing.lg,
            marginTop: theme.spacing.md,
            opacity: pressed ? 0.92 : 1,
            ...theme.shadows.md,
            shadowColor: theme.colors.accent,
            shadowOpacity: 0.3,
          })}
        >
          <Dices color={HERO_TEXT} size={20} strokeWidth={2.4} />
          <Text
            style={{
              color: HERO_TEXT,
              fontSize: 16,
              lineHeight: 22,
              fontWeight: "800",
            }}
          >
            {t.grammarHub.randomSprint}
          </Text>
        </Pressable>

        {/* Full construction list — for users who want to drill a specific
            pattern rather than going via the random sprint. Cycles through a
            pastel palette so the rows feel related to the rest of the screen
            but visually distinct from the dark hero/CTA. */}
        <View style={{ gap: theme.spacing.md }}>
          <SectionHeader
            label={t.grammarHub.constructionsLabel}
            trailing={fmt(
              constructions.length === 1
                ? t.grammarHub.patternsCountOne
                : t.grammarHub.patternsCountOther,
              { n: constructions.length },
            )}
          />
          <View style={{ gap: theme.spacing.sm }}>
            {constructions.map((c, idx) => (
              <ConstructionRow
                key={c.id}
                construction={c}
                tone={CONSTRUCTION_TONES[idx % CONSTRUCTION_TONES.length]!}
                onPress={() => openConstruction(c.id)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CircleIconButton({
  children,
  label,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function SectionHeader({
  label,
  trailing,
}: {
  label: string;
  trailing?: string;
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
      <View style={{ flex: 1 }} />
      {trailing ? (
        <Text variant="small" color="tertiary">
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

function PersonalCollectionCard({
  count,
  phrases,
  onPress,
}: {
  count: number;
  phrases: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.grammarHub.myPatternsTitle}
      style={({ pressed }) => ({
        backgroundColor: HERO_BG,
        borderRadius: theme.radii.xl,
        padding: theme.spacing.lg,
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
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="grammarGlow" cx="82%" cy="42%" r="70%">
              <Stop offset="0%" stopColor={HERO_GLOW} stopOpacity={0.85} />
              <Stop offset="60%" stopColor={HERO_GLOW} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={HERO_GLOW} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill="url(#grammarGlow)" />
        </Svg>
      </View>
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -40,
          bottom: -50,
          fontSize: 220,
          lineHeight: 220,
          fontWeight: "900",
          color: HERO_WATERMARK,
        }}
      >
        我
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
            width: 56,
            height: 56,
            borderRadius: theme.radii.md,
            backgroundColor: RED_AVATAR_TILE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <User color={theme.colors.accent} size={28} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: HERO_GOLD,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 1.4,
              fontWeight: "800",
            }}
          >
            {t.grammarHub.myCollectionLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: HERO_TEXT,
              fontSize: 18,
              lineHeight: 24,
              fontWeight: "800",
            }}
          >
            {t.grammarHub.myPatternsTitle}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: HERO_TEXT_DIM,
              fontSize: 13,
              lineHeight: 18,
            }}
          >
            {count === 0 && phrases === 0
              ? t.grammarHub.myCollectionEmpty
              : `${fmt(count === 1 ? t.grammarHub.constructionsCountOne : t.grammarHub.constructionsCountOther, { n: count })} · ${fmt(phrases === 1 ? t.grammarHub.phrasesCountOne : t.grammarHub.phrasesCountOther, { n: phrases })}`}
          </Text>
        </View>
        <ChevronRight color={HERO_TEXT_DIM} size={22} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

function GrammarLevelCard({
  level,
  total,
  completed,
  active,
  isNew,
  onPress,
}: {
  level: GrammarLevel;
  total: number;
  completed: number;
  active: boolean;
  isNew: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const done = total > 0 && completed >= total;
  const labelColor = active ? HERO_GOLD : theme.colors.textTertiary;
  const numberColor = active ? HERO_TEXT : theme.colors.textPrimary;
  // Progress sub-line colour follows status: green if complete, gold if
  // in-progress on the active card, muted otherwise.
  const progressColor = done
    ? "#22A06B"
    : active
      ? HERO_GOLD
      : theme.colors.textTertiary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fmt(t.grammarHub.grammarLevelA11y, { n: level })}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: active ? GRAMMAR_CARD_DARK : theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: active ? 0 : 1,
        borderColor: theme.colors.border,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.md,
        gap: 6,
        alignItems: "center",
        opacity: pressed ? 0.92 : 1,
        overflow: "hidden",
        minHeight: 130,
        justifyContent: "center",
      })}
    >
      {isNew && !active ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: theme.colors.accent,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 10,
              lineHeight: 12,
              fontWeight: "800",
              letterSpacing: 0.4,
            }}
          >
            NEW
          </Text>
        </View>
      ) : null}
      <Text
        style={{
          color: labelColor,
          fontSize: 12,
          lineHeight: 14,
          fontWeight: "700",
          letterSpacing: 1.2,
        }}
      >
        HSK
      </Text>
      <Text
        style={{
          color: numberColor,
          fontSize: 44,
          lineHeight: 50,
          fontWeight: "900",
          letterSpacing: -1,
        }}
      >
        {level}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {done ? (
          <Check color={progressColor} size={14} strokeWidth={3} />
        ) : null}
        <Text
          style={{
            color: progressColor,
            fontSize: 13,
            lineHeight: 16,
            fontWeight: "700",
          }}
        >
          {completed} / {total}
        </Text>
      </View>
    </Pressable>
  );
}

function LexicalLevelPill({
  grammarLevel,
  level,
  wordCount,
  active,
  onPress,
}: {
  grammarLevel: GrammarLevel;
  level: LexicalLevel;
  wordCount: number;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  // Label is "HSK N" when grammar+lexical match (smallest scope), else
  // "HSK 1–N" (the syllabus convention: cumulative coverage).
  const labelTopText =
    grammarLevel === level ? `HSK ${level}` : `HSK 1—${level}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={labelTopText}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: active ? theme.colors.accent : theme.colors.surface,
        borderWidth: active ? 0 : 1,
        borderColor: theme.colors.border,
        alignItems: "center",
        minWidth: 92,
        gap: 2,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Text
        style={{
          color: active ? "#FFFFFF" : theme.colors.textPrimary,
          fontSize: 14,
          lineHeight: 18,
          fontWeight: "800",
        }}
      >
        {labelTopText}
      </Text>
      <Text
        style={{
          color: active ? "rgba(255,255,255,0.85)" : theme.colors.textTertiary,
          fontSize: 12,
          lineHeight: 16,
          fontWeight: "600",
        }}
      >
        {formatWordCount(wordCount)}
      </Text>
    </Pressable>
  );
}

function ConstructionRow({
  construction,
  tone,
  onPress,
}: {
  construction: Construction;
  tone: { tile: string; fg: string };
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const lang = useLang();
  const phraseCount = construction.patterns.length;
  const anchor = firstHanzi(construction.name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={construction.name}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: theme.spacing.md,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.md,
        gap: theme.spacing.md,
        opacity: pressed ? 0.9 : 1,
        overflow: "hidden",
      })}
    >
      {/* Coloured hanzi tile — picks just the first character of the
          construction's name (e.g. "把 bǎ" → "把") so the row reads at a
          glance even when the full label is in Chinese script. */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: theme.radii.md,
          backgroundColor: tone.tile,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          chinese
          numberOfLines={1}
          style={{
            color: tone.fg,
            fontSize: 24,
            lineHeight: 28,
            fontWeight: "800",
          }}
        >
          {anchor}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          chinese
          numberOfLines={1}
          style={{
            color: theme.colors.textPrimary,
            fontSize: 17,
            lineHeight: 22,
            fontWeight: "700",
          }}
        >
          {construction.name}
        </Text>
        <Text variant="small" color="secondary" numberOfLines={1}>
          {constructionName(construction, lang)}
        </Text>
        <Text
          variant="caption"
          color="tertiary"
          numberOfLines={1}
          style={{ letterSpacing: 0, marginTop: 2 }}
        >
          {fmt(phraseCount === 1 ? t.grammarHub.phrasesCountOne : t.grammarHub.phrasesCountOther, { n: phraseCount })}
          {"  ·  "}
          {construction.pattern}
        </Text>
      </View>

      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.accentMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronRight color={theme.colors.accent} size={18} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

/** Pull the leading hanzi cluster off a construction name like "是…的" or
 *  "没/没有 méi/méiyǒu". Falls back to the whole name if no hanzi prefix. */
function firstHanzi(name: string): string {
  const match = name.match(/^[一-鿿/.…\s]+/);
  return (match ? match[0] : name).trim();
}
