import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookmarkCheck, BookmarkPlus, Check, CheckSquare, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { WordCard } from "@/components/cards/WordCard";
import { BulkSaveToDeckSheet } from "@/components/cards/BulkSaveToDeckSheet";
import { SaveToDeckSheet } from "@/components/cards/SaveToDeckSheet";
import { WordDetailSheet, type WordDetail } from "@/components/cards/WordDetailSheet";
import { Button, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { addWord } from "@/features/vocab/vocab";
import {
  bulkAddToDeck,
  fetchCatalog,
  fetchSavedHanziSet,
  fetchTranslations,
  normalizePinyin,
  type HskWord,
  type PosTag,
  type Syllabus,
} from "@/features/hsk/hsk";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const POS_I18N_KEY: Record<PosTag, keyof Translations["hsk"]> = {
  noun: "posLabelNoun",
  verb: "posLabelVerb",
  adjective: "posLabelAdjective",
  adverb: "posLabelAdverb",
  classifier: "posLabelClassifier",
  particle: "posLabelParticle",
  pronoun: "posLabelPronoun",
  conjunction: "posLabelConjunction",
  preposition: "posLabelPreposition",
  interjection: "posLabelInterjection",
  number: "posLabelNumber",
  proper: "posLabelProper",
};

function posLabel(t: Translations, tag: PosTag): string {
  return t.hsk[POS_I18N_KEY[tag]];
}

export default function HskLevelList() {
  const theme = useTheme();
  const t = useT();
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
  // Target for the deck-picker sheet — opened via the inline bookmark
  // button on each list row. The modal's onFirstAdd path writes the row
  // to saved_words before the first deck-membership is created.
  const [saveTarget, setSaveTarget] = useState<HskWord | null>(null);
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [posFilter, setPosFilter] = useState<PosTag | null>(null);
  const [query, setQuery] = useState("");
  // Multi-select mode — when on, tapping rows toggles selection instead
  // of opening the detail sheet, and a floating action bar offers
  // "В колоду" for the selected hanzi.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedHanzi, setSelectedHanzi] = useState<Set<string>>(new Set());
  const [bulkSaveOpen, setBulkSaveOpen] = useState(false);

  function toggleSelected(hanzi: string) {
    setSelectedHanzi((prev) => {
      const next = new Set(prev);
      if (next.has(hanzi)) next.delete(hanzi);
      else next.add(hanzi);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedHanzi(new Set());
  }

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
      toast.info(t.hsk.listLoadingTranslations);
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
      toast.success(fmt(t.hsk.listSavedToast, { hanzi: w.hanzi }));
    } else {
      toast.error(t.hsk.listSaveError);
    }
  }

  async function handleSaveAll() {
    if (!session || savingAll) return;
    const unsaved = filteredWords.filter((w) => !saved.has(w.hanzi));
    const ready = unsaved.filter((w) => meanings[w.hanzi]?.length);
    if (ready.length === 0) {
      toast.info(t.hsk.listSavingTranslations);
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
    toast.success(fmt(t.hsk.listAddedToast, { n: added }));
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
    const q = query.trim();
    const qLower = q.toLowerCase();
    const qNorm = normalizePinyin(q);
    return words.filter((w) => {
      if (posFilter && !(w.pos ?? []).includes(posFilter)) return false;
      if (!q) return true;
      // Match on hanzi (substring), pinyin (tone-insensitive normalize) or
      // any of the cached meanings — covers the user typing in their UI
      // language, in pinyin without diacritics, or by part of the glyph.
      if (w.hanzi.includes(q)) return true;
      if (normalizePinyin(w.pinyin).includes(qNorm)) return true;
      const ms = meanings[w.hanzi];
      if (ms && ms.some((m) => m.toLowerCase().includes(qLower))) return true;
      return false;
    });
  }, [words, posFilter, query, meanings]);

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
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {syllabus === "new" ? t.hsk.syllabusNew : t.hsk.syllabusOld}
          </Text>
          <Text variant="h3">{fmt(t.hsk.topicHskBadge, { n: level })}</Text>
        </View>
        <Pressable
          onPress={selectMode ? exitSelectMode : () => setSelectMode(true)}
          accessibilityRole="button"
          accessibilityLabel={selectMode ? t.common.done : t.hsk.select}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: selectMode ? theme.colors.textPrimary : theme.colors.surface,
            borderWidth: 1,
            borderColor: selectMode ? theme.colors.textPrimary : theme.colors.border,
          }}
        >
          <CheckSquare
            color={selectMode ? "#FFFFFF" : theme.colors.textPrimary}
            size={14}
            strokeWidth={2.2}
          />
          <Text
            style={{
              color: selectMode ? "#FFFFFF" : theme.colors.textPrimary,
              fontSize: 13,
              lineHeight: 16,
              fontWeight: "700",
            }}
          >
            {selectMode ? t.common.done : t.hsk.select}
          </Text>
        </Pressable>
      </View>

      {/* Search input — matches hanzi / pinyin (tone-insensitive) / meaning */}
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 8,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Search color={theme.colors.textTertiary} size={16} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.hsk.searchPlaceholder}
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              fontSize: 14,
              color: theme.colors.textPrimary,
              padding: 0,
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X color={theme.colors.textTertiary} size={16} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>
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
            label={t.hsk.posChipsAll}
            active={posFilter === null}
            onPress={() => setPosFilter(null)}
          />
          {posCounts.map(([tag, count]) => (
            <PosChip
              key={tag}
              label={`${posLabel(t, tag)} ${count}`}
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
                {t.hsk.listEmpty}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <WordRow
              word={item}
              meaning={meanings[item.hanzi]?.[0]}
              isSaved={saved.has(item.hanzi)}
              onSave={() => setSaveTarget(item)}
              selectMode={selectMode}
              selected={selectedHanzi.has(item.hanzi)}
              onToggleSelect={() => toggleSelected(item.hanzi)}
              onPress={() =>
                selectMode
                  ? toggleSelected(item.hanzi)
                  : setDetail({
                      hanzi: item.hanzi,
                      pinyin: item.pinyin,
                      english: meanings[item.hanzi]?.[0] ?? "",
                      meanings: meanings[item.hanzi],
                      hskLevel: item.hsk_new ?? item.hsk_old,
                      posLabel: item.pos?.[0]
                        ? posLabel(t, item.pos[0] as PosTag)
                        : null,
                    })
              }
            />
          )}
        />
      )}

      <WordDetailSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        word={detail}
        isSaved={detail ? saved.has(detail.hanzi) : false}
        onSave={
          detail && !saved.has(detail.hanzi)
            ? () => {
                const w = words.find((x) => x.hanzi === detail.hanzi);
                if (w) void handleSave(w);
              }
            : undefined
        }
      />

      {/* Deck picker for HSK rows — `onFirstAdd` only runs for unsaved
          words so the existing handleSave (which writes to saved_words)
          isn't called on words that are already in the master deck. */}
      <SaveToDeckSheet
        visible={saveTarget !== null}
        onClose={() => setSaveTarget(null)}
        hanzi={saveTarget?.hanzi ?? ""}
        pinyin={saveTarget?.pinyin}
        onFirstAdd={
          saveTarget && !saved.has(saveTarget.hanzi)
            ? async () => {
                await handleSave(saveTarget);
              }
            : undefined
        }
      />


      {/* Bottom action bar — in select mode it morphs into a bulk-save
          dock; otherwise the existing Practice / SaveAll dyad shows. */}
      {!loading && selectMode ? (
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
            alignItems: "center",
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">
              {fmt(t.hsk.wordsSelected, { n: selectedHanzi.size })}
            </Text>
          </View>
          <Button
            label={t.common.cancel}
            variant="ghost"
            onPress={exitSelectMode}
          />
          <Button
            label={t.hsk.toDeck}
            onPress={() => setBulkSaveOpen(true)}
            disabled={selectedHanzi.size === 0}
          />
        </View>
      ) : !loading ? (
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
            label={fmt(t.hsk.listPractice, { n: Math.min(20, filteredWords.length) })}
            onPress={handlePractice}
            disabled={filteredWords.length === 0}
            fullWidth
            style={{ flex: 1 }}
          />
          <Button
            label={savingAll ? t.common.saving : fmt(t.hsk.listSaveN, { n: unsavedCount })}
            variant="secondary"
            onPress={handleSaveAll}
            disabled={savingAll || unsavedCount === 0}
            fullWidth
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      {/* Bulk save — picks a deck (existing or new) for all selected words.
          `onEnsureSaved` upserts saved_words for unsaved hanzi so deck
          membership doesn't dangle past the master deck. */}
      <BulkSaveToDeckSheet
        visible={bulkSaveOpen}
        onClose={() => setBulkSaveOpen(false)}
        hanziList={Array.from(selectedHanzi)}
        onEnsureSaved={async (hanziList) => {
          const unsavedWords = hanziList
            .map((h) => words.find((w) => w.hanzi === h))
            .filter((w): w is HskWord => !!w && !saved.has(w.hanzi));
          for (const w of unsavedWords) {
            await handleSave(w);
          }
        }}
        onSaved={() => {
          exitSelectMode();
        }}
      />
    </Screen>
  );
}

function WordRow({
  word,
  meaning,
  isSaved,
  onSave,
  onPress,
  selectMode,
  selected,
  onToggleSelect,
}: {
  word: HskWord;
  meaning: string | undefined;
  isSaved: boolean;
  onSave: () => void;
  onPress: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const primaryPos = word.pos?.[0] as PosTag | undefined;

  return (
    <WordCard
      hanzi={word.hanzi}
      pinyin={word.pinyin}
      english={meaning}
      onPress={onPress}
      badges={
        primaryPos ? (
          <View
            style={{
              paddingVertical: 1,
              paddingHorizontal: 6,
              borderRadius: theme.radii.full,
              backgroundColor: theme.colors.surfaceHover,
            }}
          >
            <Text variant="caption" color="tertiary">
              {posLabel(t, primaryPos)}
            </Text>
          </View>
        ) : null
      }
      trailing={
        selectMode ? (
          // In select mode the trailing slot becomes a checkbox. Tapping
          // anywhere on the row already toggles via onPress, but a clearly
          // visible checkbox makes the state legible at a glance.
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSelect();
            }}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: selected ? theme.colors.accent : "transparent",
              borderWidth: selected ? 0 : 1.5,
              borderColor: theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selected ? (
              <Check color="#FFFFFF" size={14} strokeWidth={3} />
            ) : null}
          </Pressable>
        ) : (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              if (!isSaved) onSave();
            }}
            disabled={isSaved}
            hitSlop={8}
            accessibilityLabel={isSaved ? t.vocab.add.title : fmt(t.hsk.listSavedToast, { hanzi: word.hanzi })}
            style={{ padding: 4 }}
          >
            {isSaved ? (
              <BookmarkCheck color={theme.colors.success} size={20} strokeWidth={2} />
            ) : (
              <BookmarkPlus color={theme.colors.accent} size={20} strokeWidth={2} />
            )}
          </Pressable>
        )
      }
    />
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
