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
  fetchByTopic,
  fetchSavedHanziSet,
  fetchTopics,
  fetchTranslations,
  POS_LABELS,
  type HskWord,
  type PosTag,
  type Topic,
} from "@/features/hsk/hsk";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function TopicDetail() {
  const theme = useTheme();
  const toast = useToast();
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);

  const params = useLocalSearchParams<{ id?: string }>();
  const topicId = params.id ?? "";
  const lang = profile?.native_language ?? "en";

  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<HskWord[]>([]);
  const [meanings, setMeanings] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [strokeHanzi, setStrokeHanzi] = useState<string | null>(null);
  const [hskFilter, setHskFilter] = useState<{ syllabus: "old" | "new"; level: number } | null>(
    null,
  );

  // Fetch topic meta + words + saved set in parallel.
  useEffect(() => {
    if (!session || !topicId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchTopics(),
      fetchByTopic(topicId),
      fetchSavedHanziSet(session.user.id),
    ]).then(([allTopics, list, savedSet]) => {
      if (cancelled) return;
      const t = allTopics.find((x) => x.id === topicId) ?? null;
      setTopic(t);
      setWords(list);
      setSaved(savedSet);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session, topicId]);

  // Lazy-fill translations.
  useEffect(() => {
    if (loading || words.length === 0) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < words.length; i += 100) {
        if (cancelled) return;
        const slice = words.slice(i, i + 100);
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

  // Distribution of HSK levels in this topic, used for the filter strip.
  const levelChips = useMemo(() => {
    type Key = `new-${number}` | `old-${number}`;
    const counts = new Map<Key, { syllabus: "old" | "new"; level: number; count: number }>();
    for (const w of words) {
      if (w.hsk_new) {
        const k = `new-${w.hsk_new}` as Key;
        const cur = counts.get(k);
        if (cur) cur.count += 1;
        else counts.set(k, { syllabus: "new", level: w.hsk_new, count: 1 });
      } else if (w.hsk_old) {
        const k = `old-${w.hsk_old}` as Key;
        const cur = counts.get(k);
        if (cur) cur.count += 1;
        else counts.set(k, { syllabus: "old", level: w.hsk_old, count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => {
      if (a.syllabus !== b.syllabus) return a.syllabus === "new" ? -1 : 1;
      return a.level - b.level;
    });
  }, [words]);

  const filteredWords = useMemo(() => {
    if (!hskFilter) return words;
    return words.filter((w) => {
      if (hskFilter.syllabus === "new") return w.hsk_new === hskFilter.level;
      return w.hsk_old === hskFilter.level;
    });
  }, [words, hskFilter]);

  async function handleSave(w: HskWord) {
    if (!session) return;
    const meaning = meanings[w.hanzi]?.[0] ?? "";
    if (!meaning) {
      toast.info("Translation still loading");
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
    router.push(`/(app)/vocab/review?mode=hsk-topic&topic=${encodeURIComponent(topicId)}`);
  }

  const unsavedCount = filteredWords.filter((w) => !saved.has(w.hanzi)).length;
  const topicName = topic?.name[lang] ?? topic?.name.en ?? topicId;

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
        <Text style={{ fontSize: 28, lineHeight: 32 }}>{topic?.emoji ?? "📦"}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            Topic
          </Text>
          <Text variant="h3">{topicName}</Text>
        </View>
        <Text variant="small" color="tertiary">
          {hskFilter ? `${filteredWords.length} / ${words.length}` : words.length}
        </Text>
      </View>

      {!loading && levelChips.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
            gap: theme.spacing.xs,
          }}
        >
          <Chip label="All HSK" active={hskFilter === null} onPress={() => setHskFilter(null)} />
          {levelChips.map((c) => (
            <Chip
              key={`${c.syllabus}-${c.level}`}
              label={`${c.syllabus === "new" ? "HSK" : "HSK old"} ${c.level} · ${c.count}`}
              active={
                hskFilter !== null &&
                hskFilter.syllabus === c.syllabus &&
                hskFilter.level === c.level
              }
              onPress={() => setHskFilter({ syllabus: c.syllabus, level: c.level })}
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
                No words yet for this topic at this level.
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

      {!loading && filteredWords.length > 0 ? (
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
  const hskBadge =
    word.hsk_new !== null
      ? `HSK ${word.hsk_new}`
      : word.hsk_old !== null
        ? `HSK ${word.hsk_old} (old)`
        : null;

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text variant="small" color="secondary">
            {word.pinyin}
          </Text>
          {primaryPos ? <Pill text={POS_LABELS[primaryPos].label} tone="neutral" /> : null}
          {hskBadge ? <Pill text={hskBadge} tone="accent" /> : null}
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
      <Pressable onPress={onShowStrokes} hitSlop={8} style={{ padding: 4 }}>
        <PenTool color={theme.colors.textTertiary} size={18} strokeWidth={2} />
      </Pressable>
      <Pressable
        onPress={isSaved ? undefined : onSave}
        disabled={isSaved}
        hitSlop={8}
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

function Chip({
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

function Pill({ text, tone }: { text: string; tone: "accent" | "neutral" }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: 1,
        paddingHorizontal: 6,
        borderRadius: theme.radii.full,
        backgroundColor:
          tone === "accent" ? theme.colors.accentMuted : theme.colors.surfaceHover,
      }}
    >
      <Text variant="caption" color={tone === "accent" ? "accent" : "tertiary"}>
        {text}
      </Text>
    </View>
  );
}
