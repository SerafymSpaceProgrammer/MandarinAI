import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookmarkCheck, BookmarkPlus, PenTool } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import { StrokeViewerModal } from "@/components/StrokeViewerModal";
import { Button, Screen, Text, useToast } from "@/components/ui";
import { addWord } from "@/features/vocab/vocab";
import {
  bulkAddToDeck,
  fetchCatalog,
  fetchSavedHanziSet,
  fetchTranslations,
  POS_LABELS,
  type HskWord,
  type PosTag,
  type Syllabus,
} from "@/features/hsk/hsk";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function HskLevelList() {
  const theme = useTheme();
  const toast = useToast();
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);

  const params = useLocalSearchParams<{ syllabus?: string; level?: string }>();
  const syllabus = (params.syllabus === "old" ? "old" : "new") as Syllabus;
  const level = Number(params.level ?? 0) || 1;
  const lang = profile?.native_language ?? "en";

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<HskWord[]>([]);
  const [meanings, setMeanings] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [strokeHanzi, setStrokeHanzi] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<PosTag | null>(null);

  // Pull catalog + saved set in parallel.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchCatalog(syllabus, level),
      fetchSavedHanziSet(session.user.id),
    ]).then(([cat, savedSet]) => {
      if (cancelled) return;
      setWords(cat);
      setSaved(savedSet);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session, syllabus, level]);

  // Lazy-fill translations in chunks of 50 once the catalog loads.
  useEffect(() => {
    if (loading || words.length === 0) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < words.length; i += 50) {
        if (cancelled) return;
        const slice = words.slice(i, i + 50);
        const partial = await fetchTranslations(
          slice.map((w) => w.hanzi),
          lang,
        );
        if (cancelled) return;
        setMeanings((prev) => ({ ...prev, ...partial }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, words, lang]);

  async function handleSave(w: HskWord) {
    if (!session) return;
    const meaning = meanings[w.hanzi]?.[0] ?? "";
    if (!meaning) {
      toast.info("Translation still loading — try again in a moment");
      return;
    }
    const result = await addWord({
      userId: session.user.id,
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      english: meaning,
      hskLevel: w.hsk_new ?? w.hsk_old ?? 0,
    });
    if (result) {
      setSaved((s) => new Set([...s, w.hanzi]));
      toast.success(`Saved ${w.hanzi}`);
    } else {
      toast.error("Couldn't save");
    }
  }

  async function handleSaveAll() {
    if (!session || savingAll) return;
    const unsaved = filteredWords.filter((w) => !saved.has(w.hanzi));
    const ready = unsaved.filter((w) => meanings[w.hanzi]?.length);
    if (ready.length === 0) {
      toast.info("Translations still loading");
      return;
    }
    setSavingAll(true);
    const { added } = await bulkAddToDeck(
      session.user.id,
      ready.map((w) => ({
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        meaning: meanings[w.hanzi]?.[0] ?? "",
        hsk_level: w.hsk_new ?? w.hsk_old ?? 0,
      })),
    );
    setSavingAll(false);
    setSaved((s) => new Set([...s, ...ready.map((w) => w.hanzi)]));
    toast.success(`Added ${added} words to your deck`);
  }

  function handlePractice() {
    router.push(`/(app)/vocab/review?mode=hsk&syllabus=${syllabus}&level=${level}`);
  }

  const posCounts = useMemo(() => {
    const counts = new Map<PosTag, number>();
    for (const w of words) {
      for (const p of w.pos ?? []) counts.set(p as PosTag, (counts.get(p as PosTag) ?? 0) + 1);
    }
    // Sort tags by frequency (descending) so the most useful filter chips
    // come first. Only show tags that have at least one word in this level.
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [words]);

  const filteredWords = useMemo(() => {
    if (!posFilter) return words;
    return words.filter((w) => (w.pos ?? []).includes(posFilter));
  }, [words, posFilter]);

  const unsavedCount = filteredWords.filter((w) => !saved.has(w.hanzi)).length;

  return (
    <Screen>
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Back">
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {syllabus === "new" ? "HSK 3.0" : "HSK Classic"}
          </Text>
          <Text variant="h3">HSK {level}</Text>
        </View>
        <Text variant="small" color="tertiary">
          {posFilter ? `${filteredWords.length} / ${words.length}` : words.length}
        </Text>
      </View>

      {/* POS filter chip strip */}
      {!loading && posCounts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
            gap: theme.spacing.xs,
          }}
        >
          <PosChip
            label="All"
            active={posFilter === null}
            onPress={() => setPosFilter(null)}
          />
          {posCounts.map(([tag, count]) => (
            <PosChip
              key={tag}
              label={`${POS_LABELS[tag].label} ${count}`}
              active={posFilter === tag}
              onPress={() => setPosFilter(tag)}
            />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredWords}
          keyExtractor={(w) => w.hanzi}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 130,
            gap: theme.spacing.sm,
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: theme.spacing["2xl"], alignItems: "center" }}>
              <Text variant="body" color="secondary">
                No words match this filter
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <WordRow
              word={item}
              meaning={meanings[item.hanzi]?.[0]}
              isSaved={saved.has(item.hanzi)}
              onSave={() => handleSave(item)}
              onShowStrokes={() => setStrokeHanzi(item.hanzi)}
            />
          )}
        />
      )}

      {/* Bottom action bar */}
      {!loading ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.bg,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.lg,
            flexDirection: "row",
            gap: theme.spacing.sm,
          }}
        >
          <Button
            label={`Practice ${Math.min(20, filteredWords.length)}`}
            onPress={handlePractice}
            disabled={filteredWords.length === 0}
            fullWidth
            style={{ flex: 1 }}
          />
          <Button
            label={savingAll ? "Saving…" : `Save ${unsavedCount}`}
            variant="secondary"
            onPress={handleSaveAll}
            disabled={savingAll || unsavedCount === 0}
            fullWidth
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      <StrokeViewerModal
        visible={strokeHanzi !== null}
        onClose={() => setStrokeHanzi(null)}
        hanzi={strokeHanzi ?? ""}
        pinyin={words.find((w) => w.hanzi === strokeHanzi)?.pinyin}
        english={meanings[strokeHanzi ?? ""]?.[0]}
      />
    </Screen>
  );
}

function WordRow({
  word,
  meaning,
  isSaved,
  onSave,
  onShowStrokes,
}: {
  word: HskWord;
  meaning: string | undefined;
  isSaved: boolean;
  onSave: () => void;
  onShowStrokes: () => void;
}) {
  const theme = useTheme();
  const primaryPos = word.pos?.[0] as PosTag | undefined;

  return (
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
      <Pressable onPress={onShowStrokes} accessibilityLabel={`Show strokes for ${word.hanzi}`}>
        <Text chinese variant="h2">
          {word.hanzi}
        </Text>
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="small" color="secondary">
            {word.pinyin}
          </Text>
          {primaryPos ? (
            <View
              style={{
                paddingVertical: 1,
                paddingHorizontal: 6,
                borderRadius: theme.radii.full,
                backgroundColor: theme.colors.surfaceHover,
              }}
            >
              <Text variant="caption" color="tertiary">
                {POS_LABELS[primaryPos].label}
              </Text>
            </View>
          ) : null}
        </View>
        {meaning ? (
          <Text variant="body" numberOfLines={1}>
            {meaning}
          </Text>
        ) : (
          <Text variant="body" color="tertiary">
            …
          </Text>
        )}
      </View>
      <Pressable
        onPress={onShowStrokes}
        hitSlop={8}
        accessibilityLabel="Strokes"
        style={{ padding: 4 }}
      >
        <PenTool color={theme.colors.textTertiary} size={18} strokeWidth={2} />
      </Pressable>
      <Pressable
        onPress={isSaved ? undefined : onSave}
        disabled={isSaved}
        hitSlop={8}
        accessibilityLabel={isSaved ? "Already saved" : `Save ${word.hanzi}`}
        style={{ padding: 4 }}
      >
        {isSaved ? (
          <BookmarkCheck color={theme.colors.success} size={20} strokeWidth={2} />
        ) : (
          <BookmarkPlus color={theme.colors.accent} size={20} strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
}

function PosChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}
