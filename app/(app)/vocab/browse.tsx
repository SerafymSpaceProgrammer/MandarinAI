import { router } from "expo-router";
import { ArrowLeft, PenTool, Plus, Search, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StrokeViewerModal } from "@/components/StrokeViewerModal";
import { Screen, Text, useToast } from "@/components/ui";
import {
  deleteWord,
  fetchAllWords,
  type SavedWord,
} from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Filter = "all" | "due" | "learning" | "mastered";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due", label: "Due" },
  { id: "learning", label: "Learning" },
  { id: "mastered", label: "Mastered" },
];

export default function Browse() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const session = useUserStore((s) => s.session);

  const [words, setWords] = useState<SavedWord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
      toast.info(`Removed ${hanzi}`);
    } else {
      toast.error("Couldn't delete");
    }
  }

  return (
    <Screen>
      <View
        style={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Back">
            <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
          </Pressable>
          <Text variant="h3">My deck</Text>
          <Pressable
            onPress={() => router.push("/(app)/vocab/add")}
            hitSlop={16}
            accessibilityLabel="Add word"
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
            placeholder="Search hanzi, pinyin, meaning"
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
              {words.length === 0 ? "No words yet" : "Nothing matches that filter"}
            </Text>
            {words.length === 0 ? (
              <Pressable onPress={() => router.push("/(app)/vocab/add")}>
                <Text variant="bodyStrong" color="accent">
                  + Add your first word
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <WordRow word={item} onDelete={() => remove(item.hanzi)} />}
      />
    </Screen>
  );
}

function WordRow({ word, onDelete }: { word: SavedWord; onDelete: () => void }) {
  const theme = useTheme();
  const [showStrokes, setShowStrokes] = useState(false);
  const due = new Date(word.next_review_at).getTime() <= Date.now();

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Pressable
          onPress={() => setShowStrokes(true)}
          accessibilityLabel={`Show strokes for ${word.hanzi}`}
        >
          <Text chinese variant="h2">
            {word.hanzi}
          </Text>
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="small" color="secondary">
            {word.pinyin}
          </Text>
          <Text variant="body" numberOfLines={1}>
            {word.english}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
            {word.hsk_level > 0 ? (
              <Badge text={`HSK ${word.hsk_level}`} tone="accent" />
            ) : null}
            <Badge
              text={due ? "due" : `${word.review_count} reviews`}
              tone={due ? "warning" : "neutral"}
            />
          </View>
        </View>
        <Pressable
          onPress={() => setShowStrokes(true)}
          hitSlop={8}
          accessibilityLabel={`Strokes for ${word.hanzi}`}
          style={{ padding: 4 }}
        >
          <PenTool color={theme.colors.textTertiary} size={18} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={12} accessibilityLabel={`Delete ${word.hanzi}`}>
          <Trash2 color={theme.colors.textTertiary} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <StrokeViewerModal
        visible={showStrokes}
        onClose={() => setShowStrokes(false)}
        hanzi={word.hanzi}
        pinyin={word.pinyin}
        english={word.english}
      />
    </>
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
