import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookmarkCheck, BookmarkPlus, PenTool } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
  type HskWord,
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
    const unsaved = words.filter((w) => !saved.has(w.hanzi));
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

  const unsavedCount = words.filter((w) => !saved.has(w.hanzi)).length;

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
          {words.length}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={words}
          keyExtractor={(w) => w.hanzi}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 130,
            gap: theme.spacing.sm,
          }}
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
            label={`Practice ${Math.min(20, words.length)}`}
            onPress={handlePractice}
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
        <Text variant="small" color="secondary">
          {word.pinyin}
        </Text>
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
