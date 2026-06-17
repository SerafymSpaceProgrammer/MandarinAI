import { router } from "expo-router";
import {
  ArrowRight,
  GraduationCap,
  Layers,
  Sparkles,
  Target,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";

import { Screen, Text } from "@/components/ui";
import {
  fetchDeckCounts,
  listDecks,
  type UserDeck,
} from "@/features/decks/decks";
import { fetchAllWords, type SavedWord } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

// Mirror of the same brand palette used by the redesigned grammar/character
// trainers — kept inline so this screen stays pixel-traceable on its own.
const C_SURFACE = "#FFFFFF";
const C_WARM = "#F5F1EA";
const C_BORDER = "#ECE7DE";
const C_INK = "#1A1614";
const C_INK_2 = "#524A42";
const C_INK_3 = "#8A847C";
const C_RED = "#E63946";
const C_RED_DEEP = "#C8102E";
const C_RED_100 = "#FFE2E4";
const C_AMBER_INK = "#A85B00";

type Source = "deck" | "hsk";
type DeckFilter = "all" | "due" | "learning" | "weak" | "mastered";
type HskLevel = 1 | 2 | 3 | 4 | 5 | 6;

const SIZES = [10, 15, 20, 30, 50] as const;
const REPEAT_GAPS = [3, 5, 8] as const;

/**
 * Drill builder — picks a source + filter + size, then hands off to the
 * session screen via URL params. Source-specific filters live in their own
 * branch so the UI stays decluttered when switching between deck/HSK modes.
 *
 * The actual card load happens in the session (avoids stale params) — the
 * builder only previews counts off a cheap fetchAllWords for the deck path.
 */
export default function DrillBuilder() {
  const theme = useTheme();
  const t = useT();
  const session = useUserStore((s) => s.session);

  const [source, setSource] = useState<Source>("deck");
  const [deckFilter, setDeckFilter] = useState<DeckFilter>("learning");
  /** When set, overrides deckFilter — drill loads the user's named deck.
   *  Mutually exclusive with status filters in the UI. */
  const [namedDeckId, setNamedDeckId] = useState<string | null>(null);
  const [hskLevel, setHskLevel] = useState<HskLevel>(1);
  // Default to OFF — auto-exclusion of words I already have is too eager;
  // the user explicitly asked for it to be opt-in.
  const [excludeMine, setExcludeMine] = useState(false);
  const [size, setSize] = useState<(typeof SIZES)[number]>(20);
  const [repeatGap, setRepeatGap] = useState<(typeof REPEAT_GAPS)[number]>(5);

  // Local cache of the user's deck — used both for the deck preview counts
  // and for the "exclude mine" HSK filter. Loaded once on mount.
  const [deck, setDeck] = useState<SavedWord[] | null>(null);
  const [namedDecks, setNamedDecks] = useState<UserDeck[]>([]);
  const [deckCounts, setNamedDeckCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!session) return;
    fetchAllWords(session.user.id).then(setDeck).catch(() => setDeck([]));
    listDecks(session.user.id).then(async (ds) => {
      setNamedDecks(ds);
      if (ds.length > 0) {
        const counts = await fetchDeckCounts(ds.map((d) => d.id));
        setNamedDeckCounts(counts);
      }
    });
  }, [session]);

  const statusCounts = useMemo(() => {
    if (!deck) return null;
    const now = Date.now();
    return {
      all: deck.length,
      due: deck.filter((w) => new Date(w.next_review_at).getTime() <= now).length,
      learning: deck.filter((w) => w.review_count > 0 && w.review_count < 5).length,
      weak: deck.filter((w) => w.review_count > 0 && w.review_count < 2).length,
      mastered: deck.filter((w) => w.review_count >= 5).length,
    };
  }, [deck]);

  const availableCount =
    source === "deck"
      ? namedDeckId
        ? (deckCounts[namedDeckId] ?? 0)
        : statusCounts
          ? statusCounts[deckFilter]
          : null
      : null;
  const previewCount =
    source === "deck"
      ? availableCount != null
        ? Math.min(size, availableCount)
        : null
      : size;

  function start() {
    if (!session) return;
    const params =
      source === "deck"
        ? namedDeckId
          ? {
              source,
              deckId: namedDeckId,
              size: String(size),
              gap: String(repeatGap),
            }
          : {
              source,
              filter: deckFilter,
              size: String(size),
              gap: String(repeatGap),
            }
        : {
            source,
            level: String(hskLevel),
            exclude: excludeMine ? "mine" : "none",
            size: String(size),
            gap: String(repeatGap),
          };
    router.push({ pathname: "/(app)/vocab/drill/session", params });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["6xl"],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
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
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel={t.common.close}
            style={{ padding: 4 }}
          >
            <X color={C_INK} size={22} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                color: C_RED,
                fontSize: 11,
                lineHeight: 14,
                letterSpacing: 1.4,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.vocab.drill.eyebrow}
            </Text>
            <Text
              style={{
                color: C_INK,
                fontSize: 22,
                lineHeight: 26,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.vocab.drill.title}
            </Text>
          </View>
        </View>

        {/* Source */}
        <Section label={t.vocab.drill.sourceLabel} hint={t.vocab.drill.sourceHint}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SourceCard
              icon={<Layers color={source === "deck" ? "#FFFFFF" : C_INK} size={20} strokeWidth={2.2} />}
              title={t.vocab.drill.srcMyDeck}
              subtitle={
                statusCounts != null
                  ? fmt(
                      statusCounts.all === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther,
                      { n: statusCounts.all },
                    )
                  : t.vocab.drill.srcLoading
              }
              active={source === "deck"}
              onPress={() => setSource("deck")}
            />
            <SourceCard
              icon={
                <GraduationCap
                  color={source === "hsk" ? "#FFFFFF" : C_INK}
                  size={20}
                  strokeWidth={2.2}
                />
              }
              title={t.vocab.drill.srcHsk}
              subtitle={t.vocab.drill.srcHskSub}
              active={source === "hsk"}
              onPress={() => setSource("hsk")}
            />
          </View>
        </Section>

        {/* Source-specific filter */}
        {source === "deck" ? (
          <>
            <Section label={t.vocab.drill.takeLabel} hint={t.vocab.drill.takeHint}>
              <PillRow>
                <CountPill
                  label={t.vocab.drill.chipAll}
                  count={statusCounts?.all}
                  active={!namedDeckId && deckFilter === "all"}
                  onPress={() => {
                    setNamedDeckId(null);
                    setDeckFilter("all");
                  }}
                />
                <CountPill
                  label={t.vocab.drill.chipDue}
                  count={statusCounts?.due}
                  active={!namedDeckId && deckFilter === "due"}
                  onPress={() => {
                    setNamedDeckId(null);
                    setDeckFilter("due");
                  }}
                />
                <CountPill
                  label={t.vocab.drill.chipLearning}
                  count={statusCounts?.learning}
                  active={!namedDeckId && deckFilter === "learning"}
                  onPress={() => {
                    setNamedDeckId(null);
                    setDeckFilter("learning");
                  }}
                />
                <CountPill
                  label={t.vocab.drill.chipWeak}
                  count={statusCounts?.weak}
                  active={!namedDeckId && deckFilter === "weak"}
                  onPress={() => {
                    setNamedDeckId(null);
                    setDeckFilter("weak");
                  }}
                />
                <CountPill
                  label={t.vocab.drill.chipMastered}
                  count={statusCounts?.mastered}
                  active={!namedDeckId && deckFilter === "mastered"}
                  onPress={() => {
                    setNamedDeckId(null);
                    setDeckFilter("mastered");
                  }}
                />
              </PillRow>
            </Section>

            {namedDecks.length > 0 ? (
              <Section
                label={t.vocab.drill.orFromDeckLabel}
                hint={t.vocab.drill.orFromDeckHint}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {namedDecks.map((d) => (
                    <NamedDeckChip
                      key={d.id}
                      deck={d}
                      count={deckCounts[d.id] ?? 0}
                      active={namedDeckId === d.id}
                      onPress={() =>
                        setNamedDeckId((cur) => (cur === d.id ? null : d.id))
                      }
                    />
                  ))}
                </View>
              </Section>
            ) : null}
          </>
        ) : (
          <>
            <Section label={t.vocab.drill.hskLevelLabel} hint={t.vocab.drill.hskLevelHint}>
              <PillRow>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <CountPill
                    key={n}
                    label={`HSK ${n}`}
                    active={hskLevel === n}
                    onPress={() => setHskLevel(n as HskLevel)}
                  />
                ))}
              </PillRow>
            </Section>
            <Section label={t.vocab.drill.filterLabel}>
              <ToggleRow
                title={t.vocab.drill.onlyNewTitle}
                hint={t.vocab.drill.onlyNewHint}
                value={excludeMine}
                onChange={setExcludeMine}
              />
            </Section>
          </>
        )}

        {/* Size */}
        <Section label={t.vocab.drill.howManyLabel} hint={t.vocab.drill.howManyHint}>
          <PillRow>
            {SIZES.map((n) => (
              <CountPill
                key={n}
                label={String(n)}
                active={size === n}
                onPress={() => setSize(n)}
              />
            ))}
          </PillRow>
        </Section>

        {/* Repeat gap */}
        <Section
          label={t.vocab.drill.repeatAfterLabel}
          hint={t.vocab.drill.repeatAfterHint}
        >
          <PillRow>
            {REPEAT_GAPS.map((n) => (
              <CountPill
                key={n}
                label={fmt(t.vocab.drill.cardsShort, { n })}
                active={repeatGap === n}
                onPress={() => setRepeatGap(n)}
              />
            ))}
          </PillRow>
        </Section>

        {/* Preview + CTA */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 14,
              borderRadius: 12,
              backgroundColor: C_WARM,
            }}
          >
            <Target color={C_AMBER_INK} size={18} strokeWidth={2.4} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: C_INK,
                  fontSize: 14,
                  lineHeight: 18,
                  fontFamily: theme.fonts.uiBold,
                }}
              >
                {previewCount != null
                  ? fmt(
                      previewCount === 1 ? t.vocab.drill.setPreviewOne : t.vocab.drill.setPreviewOther,
                      { n: previewCount },
                    )
                  : t.vocab.drill.setLabel}
              </Text>
              {availableCount != null && availableCount < size ? (
                <Text style={{ color: C_INK_3, fontSize: 12, lineHeight: 16 }}>
                  {fmt(t.vocab.drill.onlyAvailable, { n: availableCount })}
                </Text>
              ) : (
                <Text style={{ color: C_INK_3, fontSize: 12, lineHeight: 16 }}>
                  {t.vocab.drill.twoCorrectRule}
                </Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={start}
            disabled={previewCount === 0}
            accessibilityRole="button"
            accessibilityLabel={t.vocab.drill.start}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              backgroundColor: C_RED,
              borderRadius: 16,
              paddingVertical: 16,
              opacity:
                previewCount === 0 ? 0.45 : pressed ? 0.92 : 1,
              ...theme.shadows.sm,
              shadowColor: C_RED,
              shadowOpacity: 0.3,
            })}
          >
            <Sparkles color="#FFFFFF" size={18} strokeWidth={2.4} />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                lineHeight: 20,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.vocab.drill.start}
            </Text>
            <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.6} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: C_RED }} />
        <Text
          style={{
            color: C_RED,
            fontSize: 12,
            lineHeight: 14,
            letterSpacing: 1.4,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {label}
        </Text>
      </View>
      {hint ? (
        <Text
          style={{
            color: C_INK_3,
            fontSize: 13,
            lineHeight: 18,
            paddingLeft: 13,
          }}
        >
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function SourceCard({
  icon,
  title,
  subtitle,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: active ? C_INK : C_SURFACE,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? C_INK : C_BORDER,
        padding: 12,
        gap: 8,
        minHeight: 110,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: active ? "rgba(255,255,255,0.12)" : C_WARM,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          color: active ? "#FFFFFF" : C_INK,
          fontSize: 15,
          lineHeight: 18,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: active ? "rgba(255,255,255,0.6)" : C_INK_3,
          fontSize: 12,
          lineHeight: 15,
        }}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {children}
    </View>
  );
}

function CountPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const showCount = typeof count === "number";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? C_INK : C_SURFACE,
        borderWidth: 1,
        borderColor: active ? C_INK : C_BORDER,
      }}
    >
      <Text
        style={{
          color: active ? "#FFFFFF" : C_INK,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
        }}
      >
        {label}
        {showCount ? (
          <Text
            style={{
              color: active ? "rgba(255,255,255,0.65)" : C_INK_3,
              fontFamily: theme.fonts.pinyinMono,
            }}
          >
            {"  "}· {count}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

function NamedDeckChip({
  deck,
  count,
  active,
  onPress,
}: {
  deck: UserDeck;
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
        gap: 8,
        paddingLeft: 8,
        paddingRight: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? C_INK : C_SURFACE,
        borderWidth: 1,
        borderColor: active ? C_INK : C_BORDER,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          backgroundColor: active ? "rgba(255,255,255,0.18)" : C_WARM,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 14 }}>{deck.emoji}</Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: active ? "#FFFFFF" : C_INK,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
          maxWidth: 140,
        }}
      >
        {deck.name}
        <Text
          style={{
            color: active ? "rgba(255,255,255,0.65)" : C_INK_3,
            fontFamily: theme.fonts.pinyinMono,
          }}
        >
          {"  "}· {count}
        </Text>
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingVertical: 12,
        paddingHorizontal: theme.spacing.md,
        borderRadius: 12,
        backgroundColor: C_SURFACE,
        borderWidth: 1,
        borderColor: C_BORDER,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: C_INK,
            fontSize: 15,
            lineHeight: 19,
            fontFamily: theme.fonts.uiSemiBold,
          }}
        >
          {title}
        </Text>
        {hint ? (
          <Text style={{ color: C_INK_3, fontSize: 12, lineHeight: 16 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#E5E5EA", true: C_RED }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E5E5EA"
      />
    </View>
  );
}

