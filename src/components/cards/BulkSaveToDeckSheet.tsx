import { Plus, Sparkles, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Modal, Text, useToast } from "@/components/ui";
import {
  addWordToDeck,
  createDeck,
  listDecks,
  type UserDeck,
} from "@/features/decks/decks";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Hanzi to bulk-add to the chosen deck. */
  hanziList: string[];
  /**
   * Called BEFORE deck membership writes, with the full hanzi list. Lets
   * the caller upsert saved_words rows for any ephemeral entries (HSK
   * catalog rows that don't yet have an SRS state). Awaited; deck writes
   * only run after this resolves.
   */
  onEnsureSaved?: (hanziList: string[]) => Promise<void>;
  /** Optional callback after the bulk write completes (success). */
  onSaved?: (deck: UserDeck) => void;
};

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

/**
 * Bulk-save N words into one deck. Picks a destination deck (existing or
 * new), then writes deck_words rows for every hanzi in `hanziList`. Calls
 * `onEnsureSaved` first so the caller can upsert any missing saved_words
 * rows (HSK ephemeral cards) — without that, the membership rows point at
 * hanzi the user doesn't yet own.
 */
export function BulkSaveToDeckSheet({
  visible,
  onClose,
  hanziList,
  onEnsureSaved,
  onSaved,
}: Props) {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const session = useUserStore((s) => s.session);

  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<UserDeck[]>([]);

  // Inline "create deck" expansion state — same shape as the single-word
  // SaveToDeckSheet so the user gets the same affordance.
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState<string>(DECK_EMOJI[0]!);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !session) return;
    setLoading(true);
    setCreateOpen(false);
    setDraftName("");
    setBusy(false);
    void listDecks(session.user.id).then((all) => {
      setDecks(all);
      setLoading(false);
    });
  }, [visible, session]);

  async function bulkAddTo(deck: UserDeck) {
    if (!session || busy || hanziList.length === 0) return;
    setBusy(true);
    if (onEnsureSaved) {
      try {
        await onEnsureSaved(hanziList);
      } catch (err) {
        console.warn("ensureSaved failed", err);
      }
    }
    // Membership upserts in parallel — addWordToDeck is idempotent on
    // (deck_id, hanzi) so re-adding existing entries is a noop, not an error.
    const results = await Promise.all(
      hanziList.map((h) => addWordToDeck(deck.id, h)),
    );
    setBusy(false);
    const added = results.filter(Boolean).length;
    if (added === 0) {
      toast.error(t.vocab.deckSheet.bulkAddFailed);
      return;
    }
    toast.info(
      fmt(t.vocab.deckSheet.bulkAddedToast, {
        words: fmt(added === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther, { n: added }),
        name: deck.name,
      }),
    );
    onSaved?.(deck);
    onClose();
  }

  async function createAndAdd() {
    if (!session || busy) return;
    const name = draftName.trim();
    if (!name) return;
    setBusy(true);
    const deck = await createDeck(session.user.id, name, draftEmoji);
    if (!deck) {
      setBusy(false);
      toast.error(t.vocab.deckSheet.nameTakenError);
      return;
    }
    setDecks((prev) => [deck, ...prev]);
    // The setBusy(false) below is reached after bulkAddTo runs — bulkAddTo
    // has its own busy guard so the second call's early-return doesn't
    // fire (we set busy back to false inside it).
    setBusy(false);
    void bulkAddTo(deck);
  }

  const previewLabel =
    hanziList.length === 0
      ? fmt(t.vocab.wordsCountOther, { n: 0 })
      : hanziList.length === 1
        ? hanziList[0]!
        : hanziList.length <= 5
          ? hanziList.join(" · ")
          : `${hanziList.slice(0, 4).join(" · ")} · +${hanziList.length - 4}`;

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
              lineHeight: 14,
              letterSpacing: 1.4,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {fmt(t.vocab.deckSheet.bulkTitle, {
              words: fmt(
                hanziList.length === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther,
                { n: hanziList.length },
              ).toUpperCase(),
            })}
          </Text>
          <Text
            chinese
            numberOfLines={1}
            style={{
              color: C_INK,
              fontSize: 18,
              lineHeight: 22,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {previewLabel}
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

      <ScrollView
        style={{ maxHeight: 380 }}
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
                {t.vocab.deckSheet.bulkNoDecksHint}
              </Text>
            ) : null}
            {decks.map((d) => (
              <DeckPickRow
                key={d.id}
                deck={d}
                disabled={busy}
                onPress={() => void bulkAddTo(d)}
              />
            ))}

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
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
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
                    onSubmitEditing={createAndAdd}
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
                    onPress={createAndAdd}
                    disabled={busy || draftName.trim().length === 0}
                    style={({ pressed }) => ({
                      flex: 2,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: C_RED,
                      alignItems: "center",
                      opacity:
                        busy || draftName.trim().length === 0
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
                      {busy ? t.vocab.deckSheet.saving : t.vocab.deckSheet.createAndSave}
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

      {busy ? (
        <View
          style={{
            marginTop: theme.spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: C_WARM,
          }}
        >
          <ActivityIndicator color={C_RED} />
          <Text style={{ color: C_INK_2, fontSize: 13 }}>
            {fmt(t.vocab.deckSheet.savingN, {
              words: fmt(
                hanziList.length === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther,
                { n: hanziList.length },
              ),
            })}
          </Text>
        </View>
      ) : null}
    </Modal>
  );
}

function DeckPickRow({
  deck,
  disabled,
  onPress,
}: {
  deck: UserDeck;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={fmt(t.vocab.deckSheet.addToDeckA11y, { name: deck.name })}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: C_SURFACE,
        borderWidth: 1,
        borderColor: C_BORDER,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
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
      <Sparkles color={C_RED} size={16} strokeWidth={2.2} />
    </Pressable>
  );
}

