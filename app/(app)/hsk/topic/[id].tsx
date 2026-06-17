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
  fetchByTopic,
  fetchSavedHanziSet,
  fetchTopics,
  fetchTranslations,
  normalizePinyin,
  type HskWord,
  type PosTag,
  type Topic,
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

export default function TopicDetail() {
  const theme = useTheme();
  const t = useT();
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
  const [saveTarget, setSaveTarget] = useState<HskWord | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [hskFilter, setHskFilter] = useState<{ syllabus: "old" | "new"; level: number } | null>(
    null,
  );
  const [query, setQuery] = useState("");
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
      const found = allTopics.find((x) => x.id === topicId) ?? null;
      setTopic(found);
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
    const q = query.trim();
    const qLower = q.toLowerCase();
    const qNorm = normalizePinyin(q);
    return words.filter((w) => {
      if (hskFilter) {
        if (hskFilter.syllabus === "new" && w.hsk_new !== hskFilter.level) return false;
        if (hskFilter.syllabus === "old" && w.hsk_old !== hskFilter.level) return false;
      }
      if (!q) return true;
      if (w.hanzi.includes(q)) return true;
      if (normalizePinyin(w.pinyin).includes(qNorm)) return true;
      const ms = meanings[w.hanzi];
      if (ms && ms.some((m) => m.toLowerCase().includes(qLower))) return true;
      return false;
    });
  }, [words, hskFilter, query, meanings]);

  async function handleSave(w: HskWord) {
    if (!session) return;
    const meaning = meanings[w.hanzi]?.[0] ?? "";
    if (!meaning) {
      toast.info(t.hsk.listSavingTranslations);
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
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <Text style={{ fontSize: 28, lineHeight: 32 }}>{topic?.emoji ?? "📦"}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.hsk.topicLabel}
          </Text>
          <Text variant="h3">{topicName}</Text>
        </View>
        <Pressable
          onPress={selectMode ? exitSelectMode : () => setSelectMode(true)}
          accessibilityRole="button"
          accessibilityLabel={selectMode ? "Готово" : "Выбрать"}
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
            {selectMode ? "Готово" : "Выбрать"}
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
            placeholder="Поиск по hanzi / pinyin / значению"
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
          <Chip label={t.hsk.topicHskFilterAll} active={hskFilter === null} onPress={() => setHskFilter(null)} />
          {levelChips.map((c) => (
            <Chip
              key={`${c.syllabus}-${c.level}`}
              label={`${fmt(c.syllabus === "new" ? t.hsk.topicHskBadge : t.hsk.topicHskBadgeOld, { n: c.level })} · ${c.count}`}
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
                {t.hsk.listEmptyTopic}
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
              {selectedHanzi.size} {pluralWordRu(selectedHanzi.size)}
            </Text>
            <Text variant="caption" color="tertiary">
              выбрано
            </Text>
          </View>
          <Button label="Отмена" variant="ghost" onPress={exitSelectMode} />
          <Button
            label="В колоду"
            onPress={() => setBulkSaveOpen(true)}
            disabled={selectedHanzi.size === 0}
          />
        </View>
      ) : !loading && filteredWords.length > 0 ? (
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
        onSaved={() => exitSelectMode()}
      />

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
    </Screen>
  );
}

function pluralWordRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "слово";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "слова";
  return "слов";
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
  const hskBadge =
    word.hsk_new !== null
      ? fmt(t.hsk.topicHskBadge, { n: word.hsk_new })
      : word.hsk_old !== null
        ? fmt(t.hsk.topicHskBadgeOld, { n: word.hsk_old })
        : null;

  return (
    <WordCard
      hanzi={word.hanzi}
      pinyin={word.pinyin}
      english={meaning}
      onPress={onPress}
      badges={
        <>
          {primaryPos ? <Pill text={posLabel(t, primaryPos)} tone="neutral" /> : null}
          {hskBadge ? <Pill text={hskBadge} tone="accent" /> : null}
        </>
      }
      trailing={
        selectMode ? (
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
