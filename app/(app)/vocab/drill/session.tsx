import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import {
  ArrowRight,
  Bookmark,
  Check,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  View,
} from "react-native";

import { Screen, Text } from "@/components/ui";
import { SaveToDeckSheet } from "@/components/cards/SaveToDeckSheet";
import { recordActivity } from "@/features/activity/activity";
import { fetchDeckCards } from "@/features/decks/decks";
import {
  asEphemeralCard,
  fetchCatalog,
  fetchTranslations,
} from "@/features/hsk/hsk";
import {
  DRILL_DEFAULTS,
  answerDrill,
  computeStats,
  makeDrillQueue,
  type DrillItem,
} from "@/features/vocab/drill";
import { addWord, fetchAllWords, type SavedWord } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { useTheme } from "@/theme";

const C_SURFACE = "#FFFFFF";
const C_WARM = "#F5F1EA";
const C_BORDER = "#ECE7DE";
const C_INK = "#1A1614";
const C_INK_2 = "#524A42";
const C_INK_3 = "#8A847C";
const C_RED = "#E63946";
const C_RED_DEEP = "#C8102E";
const C_RED_100 = "#FFE2E4";
const C_GREEN = "#1F8A5B";
const C_GREEN_LIGHT = "#DCEEDB";

type DeckFilter = "all" | "due" | "learning" | "weak" | "mastered";

/**
 * Drill session — Leitner-style cycling over a builder-supplied selection.
 * Cards stay in the queue until the user has answered them correctly twice
 * (by default); wrong answers reinsert the card `gap` positions ahead, so
 * the user keeps seeing it without it sitting at the head and frustrating
 * them. No SM-2 writes — the long-term schedule is untouched; only the
 * daily-activity counters tick up.
 */
export default function DrillSession() {
  const theme = useTheme();
  const t = useT();
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const lang = profile?.native_language ?? "en";
  const params = useLocalSearchParams<{
    source?: string;
    filter?: string;
    level?: string;
    exclude?: string;
    size?: string;
    gap?: string;
    deckId?: string;
  }>();

  const sizeRaw = Number(params.size ?? "20");
  const gapRaw = Number(params.gap ?? String(DRILL_DEFAULTS.repeatGap));
  const size = Number.isFinite(sizeRaw) ? Math.max(5, Math.min(100, sizeRaw)) : 20;
  const gap = Number.isFinite(gapRaw)
    ? Math.max(1, Math.min(20, gapRaw))
    : DRILL_DEFAULTS.repeatGap;

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<DrillItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [initialTotal, setInitialTotal] = useState(0);
  const [correctAttempts, setCorrectAttempts] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [startedAt] = useState(() => Date.now());
  // Target for the per-card save-to-deck modal. Tapping the bookmark icon
  // on the current drill card sets this; the modal handles deck creation +
  // first-time saved_words upsert for ephemeral HSK cards.
  const [saveTarget, setSaveTarget] = useState<SavedWord | null>(null);

  // HSK ephemeral cards aren't in saved_words yet — first deck add must
  // also upsert the row. Deck-source cards are already in saved_words,
  // and calling addWord on them would reset their SRS state, so we skip.
  const cardsAreEphemeral = params.source === "hsk";

  // Load + queue init ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const cards = await loadCards({
        userId: session.user.id,
        lang,
        source: (params.source === "hsk" ? "hsk" : "deck") as "deck" | "hsk",
        deckFilter: (params.filter ?? "learning") as DeckFilter,
        deckId: params.deckId ?? null,
        hskLevel: clampHskLevel(Number(params.level ?? "1")),
        excludeMine: params.exclude !== "none",
        size,
      });
      if (cancelled) return;
      setQueue(makeDrillQueue(cards, true));
      setInitialTotal(cards.length);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const current = queue[0];
  const stats = useMemo(
    () => computeStats(queue, initialTotal, correctAttempts, totalAttempts),
    [queue, initialTotal, correctAttempts, totalAttempts],
  );
  const isDone = !loading && initialTotal > 0 && queue.length === 0;

  function answer(correct: boolean) {
    if (!session || !current) return;
    Haptics.impactAsync(
      correct
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setQueue((q) => answerDrill(q, correct, { ...DRILL_DEFAULTS, repeatGap: gap }));
    setTotalAttempts((n) => n + 1);
    if (correct) setCorrectAttempts((n) => n + 1);
    setRevealed(false);
    // Tick activity counters once per attempt — XP scaled by correctness.
    recordActivity(session.user.id, {
      words_reviewed: 1,
      xp_earned: correct ? 2 : 1,
    });
  }

  function speakCurrent() {
    if (!current) return;
    Speech.stop().catch(() => {});
    Speech.speak(current.card.hanzi, { language: "zh-CN", rate: 0.9 });
  }

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C_RED} />
        </View>
      </Screen>
    );
  }

  if (initialTotal === 0) {
    return (
      <Screen>
        <DrillTopBar
          onClose={() => router.back()}
          uniqueCompleted={0}
          totalUnique={0}
          remaining={0}
        />
        <View
          style={{
            flex: 1,
            paddingHorizontal: theme.spacing.lg,
            justifyContent: "center",
            alignItems: "center",
            gap: theme.spacing.md,
          }}
        >
          <Text
            style={{
              color: C_INK,
              fontSize: 22,
              lineHeight: 26,
              fontFamily: theme.fonts.uiBold,
              textAlign: "center",
            }}
          >
            {t.vocab.drill.emptyTitle}
          </Text>
          <Text
            style={{
              color: C_INK_3,
              fontSize: 14,
              lineHeight: 20,
              textAlign: "center",
            }}
          >
            {t.vocab.drill.emptyBody}
          </Text>
          <Pressable
            onPress={() => router.replace("/(app)/vocab/drill")}
            style={{
              marginTop: theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: C_RED,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.vocab.drill.changeSet}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (isDone) {
    const accuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    return (
      <Screen>
        <DrillTopBar
          onClose={() => router.back()}
          uniqueCompleted={initialTotal}
          totalUnique={initialTotal}
          remaining={0}
        />
        <DrillDone
          uniqueCompleted={initialTotal}
          accuracy={accuracy}
          totalAttempts={totalAttempts}
          elapsedSec={elapsedSec}
          onAgain={() => router.replace("/(app)/vocab/drill")}
          onExit={() => router.back()}
        />
      </Screen>
    );
  }

  if (!current) return null;

  return (
    <Screen>
      <DrillTopBar
        onClose={() => router.back()}
        uniqueCompleted={stats.uniqueCompleted}
        totalUnique={stats.totalUnique}
        remaining={stats.remaining}
      />
      <SaveToDeckSheet
        visible={saveTarget !== null}
        onClose={() => setSaveTarget(null)}
        hanzi={saveTarget?.hanzi ?? ""}
        pinyin={saveTarget?.pinyin}
        onFirstAdd={
          cardsAreEphemeral && saveTarget && session
            ? async () => {
                if (!saveTarget) return;
                await addWord({
                  userId: session.user.id,
                  hanzi: saveTarget.hanzi,
                  pinyin: saveTarget.pinyin,
                  english: saveTarget.english,
                  hskLevel: saveTarget.hsk_level,
                });
              }
            : undefined
        }
      />
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        <DrillCard
          item={current}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onSpeak={speakCurrent}
          onSave={() => setSaveTarget(current.card)}
        />
        <View style={{ flex: 1 }} />
        {revealed ? (
          <View style={{ flexDirection: "row", gap: 10, paddingBottom: 24 }}>
            <Pressable
              onPress={() => answer(false)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: C_SURFACE,
                borderWidth: 2,
                borderColor: C_RED,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <X color={C_RED} size={18} strokeWidth={2.6} />
              <Text
                style={{
                  color: C_RED_DEEP,
                  fontSize: 15,
                  lineHeight: 19,
                  fontFamily: theme.fonts.uiBold,
                }}
              >
                {t.vocab.drill.dontKnow}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => answer(true)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: C_GREEN,
                opacity: pressed ? 0.92 : 1,
                ...theme.shadows.sm,
                shadowColor: C_GREEN,
                shadowOpacity: 0.3,
              })}
            >
              <Check color="#FFFFFF" size={18} strokeWidth={2.8} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 15,
                  lineHeight: 19,
                  fontFamily: theme.fonts.uiBold,
                }}
              >
                {t.vocab.drill.know}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setRevealed(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: C_RED,
              marginBottom: 24,
              opacity: pressed ? 0.92 : 1,
              ...theme.shadows.sm,
              shadowColor: C_RED,
              shadowOpacity: 0.3,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                lineHeight: 20,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.vocab.drill.show}
            </Text>
            <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.6} />
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DrillTopBar({
  onClose,
  uniqueCompleted,
  totalUnique,
  remaining,
}: {
  onClose: () => void;
  uniqueCompleted: number;
  totalUnique: number;
  remaining: number;
}) {
  const theme = useTheme();
  const t = useT();
  const pct = totalUnique > 0 ? uniqueCompleted / totalUnique : 0;
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
      }}
    >
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityLabel={t.common.close}
        style={{ padding: 4 }}
      >
        <X color={C_INK_2} size={22} strokeWidth={2.2} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: C_WARM,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${pct * 100}%`,
              height: "100%",
              backgroundColor: C_RED,
            }}
          />
        </View>
      </View>
      <Text
        style={{
          color: C_INK_2,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
          minWidth: 56,
          textAlign: "right",
        }}
      >
        {uniqueCompleted} / {totalUnique}
        {remaining > 0 ? (
          <Text
            style={{
              color: C_INK_3,
              fontFamily: theme.fonts.pinyinMono,
            }}
          >
            {"  "}· {remaining}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

function DrillCard({
  item,
  revealed,
  onReveal,
  onSpeak,
  onSave,
}: {
  item: DrillItem;
  revealed: boolean;
  onReveal: () => void;
  onSpeak: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  // Brief shake/flash when a card comes back wrong, so the user clocks
  // "this is the one I just missed" without us having to label it.
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (item.lastWrong) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      ]).start();
    }
  }, [item.card.hanzi, item.lastWrong, shake]);

  const translateX = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-6, 0, 6],
  });

  const reps = item.correctCount;
  const tag =
    item.lastWrong
      ? { text: t.vocab.drill.tagAgain, bg: C_RED_100, fg: C_RED_DEEP }
      : reps === 1
        ? { text: t.vocab.drill.tagHalf, bg: "#FFF1D6", fg: "#A85B00" }
        : reps === 0 && item.attempts === 0
          ? { text: t.vocab.drill.tagNew, bg: C_WARM, fg: C_INK_2 }
          : null;

  return (
    <Animated.View
      style={{
        transform: [{ translateX }],
        backgroundColor: C_SURFACE,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: item.lastWrong ? C_RED : C_BORDER,
        padding: 24,
        gap: 16,
        ...theme.shadows.sm,
      }}
    >
      {/* Top row — status tag (left) + save-to-deck bookmark (right) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {tag ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: tag.bg,
            }}
          >
            <Text
              style={{
                color: tag.fg,
                fontSize: 11,
                lineHeight: 14,
                letterSpacing: 0.5,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {tag.text}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Pressable
          onPress={onSave}
          hitSlop={10}
          accessibilityLabel={t.vocab.drill.saveToDeckA11y}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: C_WARM,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bookmark color={C_INK_2} size={15} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={{ alignItems: "center", gap: 12, paddingVertical: 12 }}>
        <Text
          chinese
          style={{
            color: C_INK,
            fontSize: 88,
            lineHeight: 100,
            fontFamily: theme.fonts.chineseSerifBlack,
          }}
        >
          {item.card.hanzi}
        </Text>
        {revealed ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text
                style={{
                  color: C_RED,
                  fontSize: 20,
                  lineHeight: 24,
                  fontFamily: theme.fonts.uiBold,
                  letterSpacing: 0.5,
                }}
              >
                {item.card.pinyin}
              </Text>
              <Pressable
                onPress={onSpeak}
                hitSlop={10}
                accessibilityLabel={t.vocab.drill.speakA11y}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: C_RED_100,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Volume2 color={C_RED} size={16} strokeWidth={2.4} />
              </Pressable>
            </View>
            {item.card.english ? (
              <Text
                style={{
                  color: C_INK_2,
                  fontSize: 17,
                  lineHeight: 22,
                  textAlign: "center",
                }}
              >
                {item.card.english}
              </Text>
            ) : null}
            {item.card.hsk_level ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: C_WARM,
                }}
              >
                <Text
                  style={{
                    color: C_INK_3,
                    fontSize: 11,
                    lineHeight: 14,
                    letterSpacing: 0.5,
                    fontFamily: theme.fonts.uiBold,
                  }}
                >
                  HSK {item.card.hsk_level}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Pressable
            onPress={onReveal}
            hitSlop={10}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: C_BORDER,
            }}
          >
            <Text
              style={{
                color: C_INK_3,
                fontSize: 12,
                lineHeight: 15,
                fontFamily: theme.fonts.uiSemiBold,
                letterSpacing: 0.5,
              }}
            >
              {t.vocab.drill.tapToOpen}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function DrillDone({
  uniqueCompleted,
  accuracy,
  totalAttempts,
  elapsedSec,
  onAgain,
  onExit,
}: {
  uniqueCompleted: number;
  accuracy: number;
  totalAttempts: number;
  elapsedSec: number;
  onAgain: () => void;
  onExit: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.lg,
      }}
    >
      <View style={{ alignItems: "center", gap: 12, marginTop: theme.spacing.xl }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: C_GREEN_LIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles color={C_GREEN} size={40} strokeWidth={2.2} />
        </View>
        <Text
          align="center"
          style={{
            color: C_INK,
            fontSize: 26,
            lineHeight: 32,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.vocab.drill.doneTitle}
        </Text>
        <Text
          align="center"
          style={{ color: C_INK_3, fontSize: 14, lineHeight: 20 }}
        >
          {fmt(
            uniqueCompleted === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther,
            { n: uniqueCompleted },
          )}
          {fmt(t.vocab.drill.accuracySuffix, { pct: accuracy })}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: C_SURFACE,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C_BORDER,
          paddingVertical: theme.spacing.md,
        }}
      >
        <DoneStat label={t.vocab.drill.statAnswers} value={String(totalAttempts)} />
        <View style={{ width: 1, backgroundColor: C_BORDER }} />
        <DoneStat label={t.vocab.drill.statAccuracy} value={`${accuracy}%`} />
        <View style={{ width: 1, backgroundColor: C_BORDER }} />
        <DoneStat label={t.vocab.drill.statTime} value={formatSec(elapsedSec, t)} />
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: "row", gap: 10, paddingBottom: 24 }}>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: C_SURFACE,
            borderWidth: 1,
            borderColor: C_BORDER,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: C_INK, fontSize: 15, fontFamily: theme.fonts.uiSemiBold }}>
            {t.vocab.drill.toWords}
          </Text>
        </Pressable>
        <Pressable
          onPress={onAgain}
          style={({ pressed }) => ({
            flex: 2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: C_RED,
            opacity: pressed ? 0.92 : 1,
            ...theme.shadows.sm,
            shadowColor: C_RED,
            shadowOpacity: 0.3,
          })}
        >
          <RotateCcw color="#FFFFFF" size={16} strokeWidth={2.4} />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.drill.oneMoreSet}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DoneStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={{
          color: C_INK,
          fontSize: 18,
          lineHeight: 22,
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
          letterSpacing: 1,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card loading per source/filter combination
// ─────────────────────────────────────────────────────────────────────────────

async function loadCards({
  userId,
  lang,
  source,
  deckFilter,
  deckId,
  hskLevel,
  excludeMine,
  size,
}: {
  userId: string;
  lang: string;
  source: "deck" | "hsk";
  deckFilter: DeckFilter;
  deckId: string | null;
  hskLevel: number;
  excludeMine: boolean;
  size: number;
}): Promise<SavedWord[]> {
  if (source === "deck") {
    // Named-deck path — pull only the words tagged with this deck. Status
    // filter is ignored when a specific deck is chosen (the deck IS the
    // filter); status filtering lives on top of the whole saved set.
    if (deckId) {
      const deckCards = await fetchDeckCards(userId, deckId);
      if (deckCards.length === 0) return [];
      if (lang !== "en") {
        const map = await fetchTranslations(
          deckCards.map((w) => w.hanzi),
          lang,
        );
        return shuffleAndCap(
          deckCards.map((w) => {
            const tr = map[w.hanzi]?.[0];
            return tr ? { ...w, english: tr } : w;
          }),
          size,
        );
      }
      return shuffleAndCap(deckCards, size);
    }

    const all = await fetchAllWords(userId);
    const now = Date.now();
    const filtered = all.filter((w) => {
      switch (deckFilter) {
        case "due":
          return new Date(w.next_review_at).getTime() <= now;
        case "learning":
          return w.review_count > 0 && w.review_count < 5;
        case "weak":
          return w.review_count > 0 && w.review_count < 2;
        case "mastered":
          return w.review_count >= 5;
        default:
          return true;
      }
    });
    // Optionally localize the meaning to the user's current native language
    // so the drill card doesn't show stale English to a non-English user.
    if (lang !== "en" && filtered.length > 0) {
      const map = await fetchTranslations(
        filtered.map((w) => w.hanzi),
        lang,
      );
      return shuffleAndCap(
        filtered.map((w) => {
          const tr = map[w.hanzi]?.[0];
          return tr ? { ...w, english: tr } : w;
        }),
        size,
      );
    }
    return shuffleAndCap(filtered, size);
  }

  // HSK ephemeral path — fetch the level cohort, optionally subtract the
  // user's deck, translate meanings, wrap as SavedWord-shaped objects.
  const [catalog, owned] = await Promise.all([
    fetchCatalog("new", hskLevel),
    excludeMine ? fetchAllWords(userId) : Promise.resolve([] as SavedWord[]),
  ]);
  const ownedSet = new Set(owned.map((w) => w.hanzi));
  const pool = excludeMine ? catalog.filter((w) => !ownedSet.has(w.hanzi)) : catalog;
  if (pool.length === 0) return [];
  const sample = shuffleAndCap(pool, size);
  const meanings = await fetchTranslations(
    sample.map((w) => w.hanzi),
    lang,
  );
  return sample.map((w) =>
    asEphemeralCard(w, meanings[w.hanzi]?.[0] ?? "", userId),
  );
}

function shuffleAndCap<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function clampHskLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.round(n)));
}

function formatSec(s: number, t: Translations): string {
  if (s < 60) return fmt(t.vocab.drill.secondsShort, { n: s });
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0
    ? fmt(t.vocab.drill.minutesShort, { n: m })
    : fmt(t.vocab.drill.minutesSeconds, { m, s: r });
}
