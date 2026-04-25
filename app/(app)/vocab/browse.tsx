import { router } from "expo-router";
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { WordCard } from "@/components/cards/WordCard";
import { WordDetailSheet, type WordDetail } from "@/components/cards/WordDetailSheet";
import { Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import {
  deleteWord,
  fetchAllWords,
  type SavedWord,
} from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Filter = "all" | "due" | "learning" | "mastered";

export default function Browse() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const session = useUserStore((s) => s.session);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all",       label: t.vocab.browse.filterAll },
    { id: "due",       label: t.vocab.browse.filterDue },
    { id: "learning",  label: t.vocab.browse.filterLearning },
    { id: "mastered",  label: t.vocab.browse.filterMastered },
  ];

  const [words, setWords] = useState<SavedWord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [detail, setDetail] = useState<SavedWord | null>(null);

  async function reload() {
    if (!session) return;
    const data = await fetchAllWords(session.user.id);
    setWords(data);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (q) {
        if (
          !w.hanzi.includes(q) &&
          !w.pinyin.toLowerCase().includes(q) &&
          !w.english.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      switch (filter) {
        case "due":
          return new Date(w.next_review_at).getTime() <= now;
        case "learning":
          return w.review_count > 0 && w.review_count < 5;
        case "mastered":
          return w.review_count >= 5;
        default:
          return true;
      }
    });
  }, [words, query, filter]);

  async function remove(hanzi: string) {
    if (!session) return;
    const ok = await deleteWord(session.user.id, hanzi);
    if (ok) {
      setWords((ws) => ws.filter((w) => w.hanzi !== hanzi));
      toast.info(fmt(t.vocab.browse.removed, { hanzi }));
    } else {
      toast.error(t.vocab.browse.removeError);
    }
  }

  return (
    <Screen>
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
            <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
          </Pressable>
          <Text variant="h3">{t.vocab.browse.title}</Text>
          <Pressable
            onPress={() => router.push("/(app)/vocab/add")}
            hitSlop={16}
            accessibilityLabel={t.vocab.add.title}
          >
            <Plus color={theme.colors.accent} size={24} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Search color={theme.colors.textTertiary} size={18} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.vocab.browse.searchPlaceholder}
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              height: 40,
              color: theme.colors.textPrimary,
              fontSize: 15,
            }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: theme.radii.full,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                }}
              >
                <Text variant="small" color={active ? "onAccent" : "secondary"}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.hanzi}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
        ListEmptyComponent={
          <View style={{ padding: theme.spacing["2xl"], alignItems: "center", gap: theme.spacing.sm }}>
            <Text variant="body" color="secondary">
              {words.length === 0 ? t.vocab.browse.noWords : t.vocab.browse.noMatch}
            </Text>
            {words.length === 0 ? (
              <Pressable onPress={() => router.push("/(app)/vocab/add")}>
                <Text variant="bodyStrong" color="accent">
                  {t.vocab.browse.addFirst}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <SavedWordRow
            word={item}
            onPress={() => setDetail(item)}
            onDelete={() => remove(item.hanzi)}
          />
        )}
      />

      <WordDetailSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        word={detail ? toWordDetail(detail) : null}
        onDelete={
          detail
            ? () => {
                remove(detail.hanzi);
                setDetail(null);
              }
            : undefined
        }
      />
    </Screen>
  );
}

function toWordDetail(w: SavedWord): WordDetail {
  return {
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    english: w.english,
    hskLevel: w.hsk_level,
    contextSentence: w.context_sentence,
  };
}

function SavedWordRow({
  word,
  onPress,
  onDelete,
}: {
  word: SavedWord;
  onPress: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const due = new Date(word.next_review_at).getTime() <= Date.now();

  return (
    <WordCard
      hanzi={word.hanzi}
      pinyin={word.pinyin}
      english={word.english}
      onPress={onPress}
      badges={
        <>
          {word.hsk_level > 0 ? (
            <Badge text={fmt(t.vocab.browse.hskBadge, { n: word.hsk_level })} tone="accent" />
          ) : null}
          <Badge
            text={
              due
                ? t.vocab.browse.dueBadge
                : fmt(
                    word.review_count === 1
                      ? t.vocab.browse.reviewsBadgeOne
                      : t.vocab.browse.reviewsBadgeOther,
                    { n: word.review_count },
                  )
            }
            tone={due ? "warning" : "neutral"}
          />
        </>
      }
      trailing={
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete();
          }}
          hitSlop={12}
          accessibilityLabel={t.common.close}
          style={{ padding: 4 }}
        >
          <Trash2 color={theme.colors.textTertiary} size={18} strokeWidth={2} />
        </Pressable>
      }
    />
  );
}

function Badge({ text, tone }: { text: string; tone: "accent" | "warning" | "neutral" }) {
  const theme = useTheme();
  const bg =
    tone === "accent"
      ? theme.colors.accentMuted
      : tone === "warning"
        ? theme.colors.warning
        : theme.colors.surfaceHover;
  const color: "accent" | "onAccent" | "tertiary" =
    tone === "accent" ? "accent" : tone === "warning" ? "onAccent" : "tertiary";
  return (
    <View
      style={{
        paddingVertical: 1,
        paddingHorizontal: 6,
        borderRadius: theme.radii.full,
        backgroundColor: bg,
      }}
    >
      <Text variant="caption" color={color}>
        {text}
      </Text>
    </View>
  );
}
