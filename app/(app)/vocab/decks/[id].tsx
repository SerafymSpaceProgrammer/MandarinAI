import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { WordDetailSheet, type WordDetail } from "@/components/cards/WordDetailSheet";
import { Modal, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import {
  deleteDeck,
  fetchDeckCards,
  listDecks,
  removeWordFromDeck,
  renameDeck,
  type UserDeck,
} from "@/features/decks/decks";
import { normalizePinyin } from "@/features/hsk/hsk";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";
import type { SavedWord } from "@/features/vocab/vocab";

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
const C_AMBER_TILE = "#FEF3D9";
const C_AMBER_INK = "#A85B00";

const DECK_EMOJI: string[] = [
  "📚",
  "📖",
  "✨",
  "🔥",
  "💎",
  "🌱",
  "🌸",
  "🎯",
  "⭐",
  "🌊",
];

const HSK_PILL: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#FCE4E6", fg: "#C8102E" },
  2: { bg: "#FEEDD3", fg: "#A85B00" },
  3: { bg: "#FBF3DF", fg: "#8A6A1A" },
  4: { bg: "#FFE6CC", fg: "#A85B00" },
  5: { bg: "#DCEEDB", fg: "#1F8A5B" },
  6: { bg: "#E0EAFF", fg: "#3B6FE0" },
};

/**
 * Single deck — header with title/count, big "Drill this deck" CTA, then a
 * scrollable list of every word in the deck. Words can be opened (detail
 * sheet) or removed from the deck (long-press swap to remove mode? for v1
 * the row's right-icon is a trash that confirms with a 3-second timeout).
 */
export default function DeckDetail() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const session = useUserStore((s) => s.session);
  const params = useLocalSearchParams<{ id?: string }>();
  const deckId = params.id ?? "";

  const [deck, setDeck] = useState<UserDeck | null>(null);
  const [cards, setCards] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [query, setQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session || !deckId) return;
    setLoading(true);
    // Load the deck meta + its cards in parallel. The meta comes from
    // listDecks (no single-row fetch helper yet); for the typical user with
    // < 50 decks the full list is cheap and lets us pick the row client-side.
    const [all, c] = await Promise.all([
      listDecks(session.user.id),
      fetchDeckCards(session.user.id, deckId),
    ]);
    setDeck(all.find((d) => d.id === deckId) ?? null);
    setCards(c);
    setLoading(false);
  }, [session, deckId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: cards.length,
      due: cards.filter((w) => new Date(w.next_review_at).getTime() <= now).length,
      mastered: cards.filter((w) => w.review_count >= 5).length,
    };
  }, [cards]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const qNorm = normalizePinyin(q);
    if (!q) return cards;
    return cards.filter((w) => {
      if (w.hanzi.includes(q)) return true;
      if (normalizePinyin(w.pinyin).includes(qNorm)) return true;
      if (w.english.toLowerCase().includes(qLower)) return true;
      return false;
    });
  }, [cards, query]);

  async function remove(hanzi: string) {
    if (!deck) return;
    const ok = await removeWordFromDeck(deck.id, hanzi);
    if (ok) {
      setCards((prev) => prev.filter((w) => w.hanzi !== hanzi));
      toast.info(fmt(t.vocab.decks.removedFromDeck, { hanzi }));
    } else {
      toast.error(t.vocab.decks.removeFailed);
    }
  }

  function startDrill() {
    if (!deck) return;
    router.push({
      pathname: "/(app)/vocab/drill/session",
      params: {
        source: "deck",
        deckId: deck.id,
        size: String(Math.min(20, Math.max(5, cards.length))),
        gap: "5",
      },
    });
  }

  async function onRenamed(name: string, emoji: string) {
    if (!deck) return;
    const updated = await renameDeck(deck.id, name, emoji);
    if (!updated) {
      toast.error(t.vocab.decks.renameFailed);
      return;
    }
    setDeck(updated);
    setRenameOpen(false);
    toast.info(t.vocab.decks.savedToast);
  }

  async function onDeleted() {
    if (!deck) return;
    const ok = await deleteDeck(deck.id);
    if (!ok) {
      toast.error(t.vocab.decks.deleteFailed);
      return;
    }
    setDeleteOpen(false);
    router.back();
  }

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C_RED} />
        </View>
      </Screen>
    );
  }

  if (!deck) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text
            align="center"
            style={{
              color: C_INK,
              fontSize: 18,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.decks.notFound}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: C_RED,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontFamily: theme.fonts.uiBold }}>
              {t.common.back}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.spacing["6xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
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
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t.common.back}>
            <ArrowLeft color={C_INK} size={22} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => setRenameOpen(true)}
            hitSlop={10}
            accessibilityLabel={t.vocab.decks.renameA11y}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: C_WARM,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil color={C_INK_2} size={16} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => setDeleteOpen(true)}
            hitSlop={10}
            accessibilityLabel={t.vocab.decks.deleteA11y}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: C_WARM,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 color={C_INK_2} size={16} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Deck hero — emoji + name + stats row */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              backgroundColor: C_WARM,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 40 }}>{deck.emoji}</Text>
          </View>
          <Text
            align="center"
            style={{
              color: C_INK,
              fontSize: 24,
              lineHeight: 28,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {deck.name}
          </Text>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: C_SURFACE,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C_BORDER,
              paddingVertical: 10,
              alignSelf: "stretch",
            }}
          >
            <DeckStat label={t.vocab.decks.statTotal} value={String(stats.total)} fg={C_INK} />
            <View style={{ width: 1, backgroundColor: C_BORDER }} />
            <DeckStat
              label={t.vocab.decks.statDue}
              value={String(stats.due)}
              fg={stats.due > 0 ? C_AMBER_INK : C_INK_3}
            />
            <View style={{ width: 1, backgroundColor: C_BORDER }} />
            <DeckStat
              label={t.vocab.decks.statMastered}
              value={String(stats.mastered)}
              fg={stats.mastered > 0 ? C_GREEN : C_INK_3}
            />
          </View>
        </View>

        {/* Drill CTA */}
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
          <Pressable
            onPress={startDrill}
            disabled={cards.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t.vocab.decks.drillDeck}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              backgroundColor: C_RED,
              borderRadius: 14,
              paddingVertical: 16,
              opacity: cards.length === 0 ? 0.45 : pressed ? 0.92 : 1,
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
              {t.vocab.decks.drillDeck}
            </Text>
            <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.6} />
          </Pressable>
        </View>

        {/* Search */}
        {cards.length > 0 ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 8,
                borderRadius: theme.radii.md,
                backgroundColor: C_SURFACE,
                borderWidth: 1,
                borderColor: C_BORDER,
              }}
            >
              <Search color={C_INK_3} size={16} strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t.vocab.decks.searchPlaceholder}
                placeholderTextColor={C_INK_3}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: C_INK,
                  padding: 0,
                }}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <X color={C_INK_3} size={16} strokeWidth={2.2} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Word list */}
        {cards.length === 0 ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing["2xl"],
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              align="center"
              style={{
                color: C_INK_3,
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {t.vocab.decks.emptyDeckTitle}
            </Text>
            <Text
              align="center"
              style={{
                color: C_INK_3,
                fontSize: 13,
                lineHeight: 18,
                maxWidth: 280,
              }}
            >
              {t.vocab.decks.emptyDeckBody}
            </Text>
            <Pressable
              onPress={() => router.push("/(app)/vocab/browse")}
              style={({ pressed }) => ({
                marginTop: 12,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: C_SURFACE,
                borderWidth: 1,
                borderColor: C_BORDER,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: C_INK, fontFamily: theme.fonts.uiSemiBold }}>
                {t.vocab.decks.toWordSearch}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}>
            {filtered.map((w) => (
              <DeckWordRow
                key={w.hanzi}
                word={w}
                confirming={removingId === w.hanzi}
                onPress={() =>
                  setDetail({
                    hanzi: w.hanzi,
                    pinyin: w.pinyin,
                    english: w.english,
                    hskLevel: w.hsk_level,
                    contextSentence: w.context_sentence,
                  })
                }
                onRemove={() => {
                  if (removingId === w.hanzi) {
                    void remove(w.hanzi);
                    setRemovingId(null);
                  } else {
                    setRemovingId(w.hanzi);
                    // Auto-cancel the danger state after 3s — two-tap-with-
                    // timeout is the same pattern used by personal-grammar
                    // delete, gives a friendly "are you sure?" without
                    // pulling in Alert.alert.
                    setTimeout(
                      () => setRemovingId((cur) => (cur === w.hanzi ? null : cur)),
                      3000,
                    );
                  }
                }}
              />
            ))}
            {filtered.length === 0 && query.length > 0 ? (
              <Text
                align="center"
                style={{
                  color: C_INK_3,
                  fontSize: 13,
                  lineHeight: 18,
                  paddingVertical: 16,
                }}
              >
                {fmt(t.vocab.decks.noResults, { q: query })}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <WordDetailSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        word={detail}
        isSaved
      />

      <RenameDeckModal
        visible={renameOpen}
        deck={deck}
        onClose={() => setRenameOpen(false)}
        onSubmit={onRenamed}
      />

      <ConfirmDeleteModal
        visible={deleteOpen}
        deckName={deck.name}
        count={cards.length}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDeleted}
      />
    </Screen>
  );
}

function DeckStat({
  label,
  value,
  fg,
}: {
  label: string;
  value: string;
  fg: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={{
          color: fg,
          fontSize: 20,
          lineHeight: 24,
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

function DeckWordRow({
  word,
  confirming,
  onPress,
  onRemove,
}: {
  word: SavedWord;
  confirming: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const due = new Date(word.next_review_at).getTime() <= Date.now();
  const mastered = word.review_count >= 5;
  const hskTone = HSK_PILL[word.hsk_level] ?? null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={word.hanzi}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: C_SURFACE,
        borderWidth: 1,
        borderColor: C_BORDER,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <View style={{ minWidth: 60, alignItems: "flex-start" }}>
        <Text
          style={{
            color: C_INK_3,
            fontSize: 11,
            lineHeight: 14,
            fontFamily: theme.fonts.pinyinMono,
          }}
          numberOfLines={1}
        >
          {word.pinyin}
        </Text>
        <Text
          chinese
          style={{
            color: C_INK,
            fontSize: 28,
            lineHeight: 34,
            fontFamily: theme.fonts.chineseSerif,
          }}
          numberOfLines={1}
        >
          {word.hanzi}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={2}
          style={{
            color: C_INK,
            fontSize: 14,
            lineHeight: 18,
            fontFamily: theme.fonts.uiSemiBold,
          }}
        >
          {word.english}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {word.hsk_level > 0 && hskTone ? (
            <Badge text={`HSK ${word.hsk_level}`} bg={hskTone.bg} fg={hskTone.fg} />
          ) : null}
          {due ? (
            <Badge text={t.vocab.decks.dueBadge} bg={C_RED_100} fg={C_RED_DEEP} />
          ) : null}
          {mastered ? (
            <Badge text={t.vocab.decks.masteredBadge} bg={C_GREEN_LIGHT} fg={C_GREEN} />
          ) : word.review_count > 0 ? (
            <Badge
              text={fmt(t.vocab.decks.repsShort, { n: word.review_count })}
              bg={C_WARM}
              fg={C_INK_2}
            />
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          onRemove();
        }}
        hitSlop={8}
        accessibilityLabel={confirming ? t.vocab.decks.confirmRemoveA11y : t.vocab.decks.removeFromDeckA11y}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: confirming ? C_RED_100 : C_WARM,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Trash2
          color={confirming ? C_RED_DEEP : C_INK_3}
          size={14}
          strokeWidth={2.2}
        />
      </Pressable>
    </Pressable>
  );
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 0.3,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function RenameDeckModal({
  visible,
  deck,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  deck: UserDeck;
  onClose: () => void;
  onSubmit: (name: string, emoji: string) => Promise<void>;
}) {
  const theme = useTheme();
  const t = useT();
  const [name, setName] = useState(deck.name);
  const [emoji, setEmoji] = useState(deck.emoji);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(deck.name);
      setEmoji(deck.emoji);
      setBusy(false);
    }
  }, [visible, deck]);

  async function submit() {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    await onSubmit(trimmed, emoji);
    setBusy(false);
  }

  return (
    <Modal visible={visible} onClose={onClose}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: C_RED,
              fontSize: 11,
              letterSpacing: 1.4,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.decks.renameLabel}
          </Text>
          <Text
            style={{
              color: C_INK,
              fontSize: 22,
              lineHeight: 26,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.decks.renameTitle}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel={t.common.close}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: C_WARM,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color={C_INK_2} size={16} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              backgroundColor: C_WARM,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={40}
            style={{
              flex: 1,
              fontSize: 15,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: C_SURFACE,
              borderWidth: 1,
              borderColor: C_BORDER,
              color: C_INK,
            }}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
        >
          {DECK_EMOJI.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                backgroundColor: emoji === e ? C_INK : C_SURFACE,
                borderWidth: emoji === e ? 0 : 1,
                borderColor: C_BORDER,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 20 }}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          onPress={submit}
          disabled={busy || name.trim().length === 0}
          style={({ pressed }) => ({
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: C_RED,
            alignItems: "center",
            opacity:
              busy || name.trim().length === 0 ? 0.5 : pressed ? 0.92 : 1,
          })}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {busy ? t.vocab.decks.saving : t.common.save}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function ConfirmDeleteModal({
  visible,
  deckName,
  count,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  deckName: string;
  count: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const theme = useTheme();
  const t = useT();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) setBusy(false);
  }, [visible]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }

  return (
    <Modal visible={visible} onClose={onClose} presentation="center">
      <View style={{ gap: theme.spacing.md }}>
        <Text
          style={{
            color: C_INK,
            fontSize: 18,
            lineHeight: 22,
            fontFamily: theme.fonts.uiBold,
            textAlign: "center",
          }}
        >
          {fmt(t.vocab.decks.deleteConfirmTitle, { name: deckName })}
        </Text>
        <Text
          style={{
            color: C_INK_3,
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
          }}
        >
          {count > 0
            ? fmt(t.vocab.decks.deleteConfirmBodyWords, { n: count })
            : t.vocab.decks.deleteConfirmBodyEmpty}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: theme.spacing.sm }}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: C_SURFACE,
              borderWidth: 1,
              borderColor: C_BORDER,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: C_INK, fontFamily: theme.fonts.uiSemiBold }}>
              {t.common.cancel}
            </Text>
          </Pressable>
          <Pressable
            onPress={confirm}
            disabled={busy}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: C_RED,
              alignItems: "center",
              opacity: busy ? 0.5 : pressed ? 0.92 : 1,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {busy ? t.vocab.decks.deleting : t.vocab.decks.delete}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
