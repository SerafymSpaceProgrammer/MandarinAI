import { Check, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Modal, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import {
  addWordToDeck,
  createDeck,
  fetchDecksForWord,
  listDecks,
  removeWordFromDeck,
  type UserDeck,
} from "@/features/decks/decks";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Hanzi of the word being saved. Used both as the deck-membership key
   *  and for the "которое слово сохраняем" headline. */
  hanzi: string;
  /** Pinyin shown under the hanzi in the header — optional. */
  pinyin?: string;
  /** Called when at least one deck membership changed (so the parent can
   *  refresh its saved-status badge). */
  onChanged?: () => void;
  /** Optional: called the FIRST time the word gets added to any deck — the
   *  parent uses this to also write the row to saved_words (so SRS state
   *  exists). If omitted, the parent is presumed to have already handled
   *  saved_words elsewhere. */
  onFirstAdd?: () => Promise<void> | void;
};

// Compact, hard-coded emoji palette for new decks. Kept inline because the
// list is short and the alternative — a free emoji picker — is a different
// scope. The user can rename + change emoji later from a manage screen.
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

const C_SURFACE = "#FFFFFF";
const C_WARM = "#F5F1EA";
const C_BORDER = "#ECE7DE";
const C_INK = "#1A1614";
const C_INK_2 = "#524A42";
const C_INK_3 = "#8A847C";
const C_RED = "#E63946";
const C_RED_100 = "#FFE2E4";
const C_GREEN = "#1F8A5B";
const C_GREEN_LIGHT = "#DCEEDB";

/**
 * Save-to-deck modal. Lists the user's existing decks (with a tick next to
 * those that already contain this word) and offers an inline "Create deck"
 * row that expands into a name + emoji input. Each tap toggles membership.
 */
export function SaveToDeckSheet({
  visible,
  onClose,
  hanzi,
  pinyin,
  onChanged,
  onFirstAdd,
}: Props) {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const session = useUserStore((s) => s.session);

  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [membership, setMembership] = useState<Set<string>>(new Set());

  // Inline "create deck" input state. Collapsed by default; the "+ Создать
  // колоду" row expands it.
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState<string>(DECK_EMOJI[0]!);
  const [creating, setCreating] = useState(false);

  // The "first add" callback should fire at most once per modal open — we
  // call it lazily on the first toggle-on so the parent doesn't spam its
  // own save logic on every membership toggle.
  const [firstAddHandled, setFirstAddHandled] = useState(false);

  useEffect(() => {
    if (!visible || !session) return;
    setLoading(true);
    setCreateOpen(false);
    setDraftName("");
    setFirstAddHandled(false);
    void Promise.all([
      listDecks(session.user.id),
      fetchDecksForWord(session.user.id, hanzi),
    ]).then(([all, owned]) => {
      setDecks(all);
      setMembership(new Set(owned.map((d) => d.id)));
      setLoading(false);
    });
  }, [visible, session, hanzi]);

  async function toggle(deck: UserDeck) {
    if (!session) return;
    const isMember = membership.has(deck.id);
    // Optimistic flip — the API calls are short, but the toggle should feel
    // instant. We roll back on failure.
    setMembership((prev) => {
      const next = new Set(prev);
      if (isMember) next.delete(deck.id);
      else next.add(deck.id);
      return next;
    });
    if (isMember) {
      const ok = await removeWordFromDeck(deck.id, hanzi);
      if (!ok) {
        toast.error(t.vocab.deckSheet.removeFailed);
        setMembership((prev) => {
          const next = new Set(prev);
          next.add(deck.id);
          return next;
        });
        return;
      }
    } else {
      // First add: make sure the saved_words row exists before the membership
      // points at a dangling hanzi. The parent owns that write because it
      // has the meaning/pinyin context this modal doesn't.
      if (!firstAddHandled && onFirstAdd) {
        try {
          await onFirstAdd();
        } catch {}
        setFirstAddHandled(true);
      }
      const ok = await addWordToDeck(deck.id, hanzi);
      if (!ok) {
        toast.error(t.vocab.deckSheet.addFailed);
        setMembership((prev) => {
          const next = new Set(prev);
          next.delete(deck.id);
          return next;
        });
        return;
      }
    }
    onChanged?.();
  }

  async function handleCreate() {
    if (!session || creating) return;
    const name = draftName.trim();
    if (!name) return;
    setCreating(true);
    const deck = await createDeck(session.user.id, name, draftEmoji);
    setCreating(false);
    if (!deck) {
      toast.error(t.vocab.deckSheet.nameTakenError);
      return;
    }
    setDecks((prev) => [deck, ...prev]);
    setCreateOpen(false);
    setDraftName("");
    // Auto-toggle the new deck on for this word — usual flow is "create deck
    // BECAUSE I want this word in it"; saving the user one extra tap.
    if (!firstAddHandled && onFirstAdd) {
      try {
        await onFirstAdd();
      } catch {}
      setFirstAddHandled(true);
    }
    const ok = await addWordToDeck(deck.id, hanzi);
    if (ok) {
      setMembership((prev) => {
        const next = new Set(prev);
        next.add(deck.id);
        return next;
      });
      onChanged?.();
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} presentation="sheet">
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
              lineHeight: 14,
              letterSpacing: 1.4,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.vocab.deckSheet.saveTitle}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text
              chinese
              style={{
                color: C_INK,
                fontSize: 22,
                lineHeight: 26,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {hanzi}
            </Text>
            {pinyin ? (
              <Text
                style={{
                  color: C_INK_3,
                  fontSize: 13,
                  fontFamily: theme.fonts.pinyinMono,
                }}
              >
                {pinyin}
              </Text>
            ) : null}
          </View>
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

      <ScrollView
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xl, alignItems: "center" }}>
            <ActivityIndicator color={C_RED} />
          </View>
        ) : (
          <>
            {decks.length === 0 ? (
              <Text
                style={{
                  color: C_INK_3,
                  fontSize: 13,
                  lineHeight: 18,
                  paddingVertical: 4,
                }}
              >
                {t.vocab.deckSheet.noDecksHint}
              </Text>
            ) : null}
            {decks.map((d) => (
              <DeckRow
                key={d.id}
                deck={d}
                selected={membership.has(d.id)}
                onPress={() => toggle(d)}
              />
            ))}

            {/* Create-deck row / expanded form */}
            {createOpen ? (
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: C_RED_100,
                  backgroundColor: "#FFFBFB",
                  padding: 12,
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    color: C_RED,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    fontFamily: theme.fonts.uiBold,
                  }}
                >
                  {t.vocab.deckSheet.newDeckLabel}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      backgroundColor: C_WARM,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{draftEmoji}</Text>
                  </View>
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder={t.vocab.deckSheet.namePlaceholder}
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
                    onSubmitEditing={handleCreate}
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
                      onPress={() => setDraftEmoji(e)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: draftEmoji === e ? C_INK : C_SURFACE,
                        borderWidth: draftEmoji === e ? 0 : 1,
                        borderColor: C_BORDER,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>{e}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setCreateOpen(false);
                      setDraftName("");
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: C_SURFACE,
                      borderWidth: 1,
                      borderColor: C_BORDER,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: C_INK,
                        fontSize: 14,
                        fontFamily: theme.fonts.uiSemiBold,
                      }}
                    >
                      {t.common.cancel}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreate}
                    disabled={creating || draftName.trim().length === 0}
                    style={({ pressed }) => ({
                      flex: 2,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: C_RED,
                      alignItems: "center",
                      opacity:
                        creating || draftName.trim().length === 0
                          ? 0.5
                          : pressed
                            ? 0.92
                            : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontFamily: theme.fonts.uiBold,
                      }}
                    >
                      {creating ? t.vocab.deckSheet.creating : t.vocab.deckSheet.createAndSave}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setCreateOpen(true)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: C_BORDER,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    backgroundColor: C_RED_100,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus color={C_RED} size={20} strokeWidth={2.4} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    color: C_INK,
                    fontSize: 15,
                    lineHeight: 19,
                    fontFamily: theme.fonts.uiSemiBold,
                  }}
                >
                  {t.vocab.deckSheet.createNewDeck}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <Pressable
        onPress={onClose}
        style={({ pressed }) => ({
          marginTop: theme.spacing.md,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: C_INK,
          alignItems: "center",
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.common.done}
        </Text>
      </Pressable>
    </Modal>
  );
}

function DeckRow({
  deck,
  selected,
  onPress,
}: {
  deck: UserDeck;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: selected ? C_GREEN_LIGHT : C_SURFACE,
        borderWidth: 1,
        borderColor: selected ? C_GREEN : C_BORDER,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          backgroundColor: selected ? "#FFFFFF" : C_WARM,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 18 }}>{deck.emoji}</Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: C_INK,
          fontSize: 15,
          lineHeight: 19,
          fontFamily: theme.fonts.uiSemiBold,
        }}
      >
        {deck.name}
      </Text>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: selected ? C_GREEN : "transparent",
          borderWidth: selected ? 0 : 1.5,
          borderColor: C_BORDER,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <Check color="#FFFFFF" size={14} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}
