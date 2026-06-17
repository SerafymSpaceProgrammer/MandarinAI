import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Sparkles,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Modal, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import {
  createDeck,
  fetchDeckCounts,
  listDecks,
  type UserDeck,
} from "@/features/decks/decks";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const C_SURFACE = "#FFFFFF";
const C_WARM = "#F5F1EA";
const C_BORDER = "#ECE7DE";
const C_INK = "#1A1614";
const C_INK_2 = "#524A42";
const C_INK_3 = "#8A847C";
const C_RED = "#E63946";
const C_RED_100 = "#FFE2E4";

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

/**
 * Decks library — list every named deck the user has, with word counts. Tap
 * a deck to drill / manage / pick words. A "+" header button opens an
 * inline create-deck modal (same affordance as SaveToDeckSheet's create
 * form, just standalone here so the user can pre-build decks before saving
 * any words to them).
 */
export default function DecksList() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const session = useUserStore((s) => s.session);
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const ds = await listDecks(session.user.id);
    setDecks(ds);
    if (ds.length > 0) {
      const c = await fetchDeckCounts(ds.map((d) => d.id));
      setCounts(c);
    } else {
      setCounts({});
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalWords = Object.values(counts).reduce((s, n) => s + n, 0);

  function onCreated(newDeck: UserDeck) {
    setDecks((prev) => [newDeck, ...prev]);
    setCreateOpen(false);
    toast.info(fmt(t.vocab.decks.createdToast, { name: newDeck.name }));
  }

  return (
    <Screen>
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
          accessibilityLabel={t.common.back}
          style={{ padding: 4 }}
        >
          <ArrowLeft color={C_INK} size={22} strokeWidth={2.2} />
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
            {t.vocab.decks.eyebrow}
          </Text>
          <Text
            style={{
              color: C_INK,
              fontSize: 22,
              lineHeight: 26,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.decks.title}
          </Text>
        </View>
        <Pressable
          onPress={() => setCreateOpen(true)}
          hitSlop={12}
          accessibilityLabel={t.vocab.decks.createA11y}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: C_RED,
            alignItems: "center",
            justifyContent: "center",
            ...theme.shadows.sm,
            shadowColor: C_RED,
            shadowOpacity: 0.25,
          }}
        >
          <Plus color="#FFFFFF" size={20} strokeWidth={2.6} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C_RED} />
        </View>
      ) : decks.length === 0 ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: theme.spacing.lg,
            justifyContent: "center",
            alignItems: "center",
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: C_RED_100,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles color={C_RED} size={36} strokeWidth={2.2} />
          </View>
          <Text
            align="center"
            style={{
              color: C_INK,
              fontSize: 20,
              lineHeight: 25,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.decks.emptyTitle}
          </Text>
          <Text
            align="center"
            style={{
              color: C_INK_3,
              fontSize: 14,
              lineHeight: 20,
              maxWidth: 280,
            }}
          >
            {t.vocab.decks.emptyBody}
          </Text>
          <Pressable
            onPress={() => setCreateOpen(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: C_RED,
              marginTop: theme.spacing.md,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Plus color="#FFFFFF" size={18} strokeWidth={2.6} />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.vocab.decks.createFirst}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing["6xl"],
            gap: 10,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              color: C_INK_3,
              fontSize: 13,
              lineHeight: 18,
              paddingVertical: 4,
            }}
          >
            {fmt(decks.length === 1 ? t.vocab.decks.decksCountOne : t.vocab.decks.decksCountOther, { n: decks.length })}
            {" · "}
            {fmt(totalWords === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther, { n: totalWords })}
          </Text>
          {decks.map((d) => (
            <DeckRow
              key={d.id}
              deck={d}
              count={counts[d.id] ?? 0}
              onPress={() =>
                router.push(`/(app)/vocab/decks/${encodeURIComponent(d.id)}`)
              }
            />
          ))}
        </ScrollView>
      )}

      <CreateDeckModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
      />
    </Screen>
  );
}

function DeckRow({
  deck,
  count,
  onPress,
}: {
  deck: UserDeck;
  count: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fmt(t.vocab.decks.deckA11y, { name: deck.name })}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 14,
        borderRadius: 14,
        backgroundColor: C_SURFACE,
        borderWidth: 1,
        borderColor: C_BORDER,
        opacity: pressed ? 0.88 : 1,
      })}
    >
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
        <Text style={{ fontSize: 24 }}>{deck.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: C_INK,
            fontSize: 16,
            lineHeight: 20,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {deck.name}
        </Text>
        <Text style={{ color: C_INK_3, fontSize: 12, lineHeight: 16 }}>
          {fmt(count === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther, { n: count })}
        </Text>
      </View>
      <ChevronRight color={C_INK_3} size={20} strokeWidth={2.2} />
    </Pressable>
  );
}

function CreateDeckModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (deck: UserDeck) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const session = useUserStore((s) => s.session);
  const toast = useToast();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>(DECK_EMOJI[0]!);
  const [busy, setBusy] = useState(false);

  // Reset draft state every time the modal closes — otherwise the next
  // create call gets the previous deck's emoji pre-selected.
  useEffect(() => {
    if (!visible) {
      setName("");
      setEmoji(DECK_EMOJI[0]!);
      setBusy(false);
    }
  }, [visible]);

  async function submit() {
    if (!session || busy) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const d = await createDeck(session.user.id, trimmed, emoji);
    setBusy(false);
    if (!d) {
      toast.error(t.vocab.decks.nameTakenError);
      return;
    }
    onCreated(d);
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
            {t.vocab.decks.newDeckLabel}
          </Text>
          <Text
            style={{
              color: C_INK,
              fontSize: 22,
              lineHeight: 26,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.decks.createDeckTitle}
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
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
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
            placeholder={t.vocab.decks.namePlaceholder}
            placeholderTextColor={C_INK_3}
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
            marginTop: 4,
          })}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {busy ? t.vocab.decks.creating : t.vocab.decks.create}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

