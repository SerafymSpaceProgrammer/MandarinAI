import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ChevronRight,
  Flame,
  Library,
  Plus,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Pressable, ScrollView, TextInput, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { BulkSaveToDeckSheet } from "@/components/cards/BulkSaveToDeckSheet";
import { SaveToDeckSheet } from "@/components/cards/SaveToDeckSheet";
import { WordDetailSheet, type WordDetail } from "@/components/cards/WordDetailSheet";
import { Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import {
  aiFallbackLookup,
  searchDictionary,
  type DictEntry,
} from "@/features/dictionary/dictionary";
import {
  fetchAllCatalog,
  fetchByTopic,
  fetchTopics,
  fetchTranslations,
  normalizePinyin,
  scoreHskMatch,
  type HskWord,
  type Topic,
} from "@/features/hsk/hsk";
import {
  addWord,
  deleteWord,
  fetchAllWords,
  type SavedWord,
} from "@/features/vocab/vocab";
import { detectTone, splitSyllables } from "@/lib/pinyinTones";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Scope = "all" | "saved" | "hsk" | "topic";
type StatusFilter = "all" | "due" | "learning" | "mastered";

type Row =
  | { kind: "saved"; word: SavedWord }
  | { kind: "hsk"; word: HskWord; meaning: string | null }
  | { kind: "dict"; entry: DictEntry };

const MAX_RESULTS = 80;
const DICT_DEBOUNCE_MS = 280;
const TOTAL_DICT = 125_000;
const TOTAL_HSK = 6_300;

// Per-HSK-level pill colour. Pastel surfaces + tone-shifted ink — matches
// the design mock's coloured "HSK N" tags (red for 1, orange for 4, etc.).
const HSK_PILL: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#FCE4E6", fg: "#C8102E" },
  2: { bg: "#FEEDD3", fg: "#A85B00" },
  3: { bg: "#FBF3DF", fg: "#8A6A1A" },
  4: { bg: "#FFE6CC", fg: "#A85B00" },
  5: { bg: "#DCEEDB", fg: "#1F8A5B" },
  6: { bg: "#E0EAFF", fg: "#3B6FE0" },
};

export default function Browse() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const lang = profile?.native_language ?? "en";

  const [saved, setSaved] = useState<SavedWord[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [catalog, setCatalog] = useState<HskWord[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [topicHanziSet, setTopicHanziSet] = useState<Set<string> | null>(null);
  const [meanings, setMeanings] = useState<Record<string, string>>({});

  const [scope, setScope] = useState<Scope>("saved");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Target for the deck-picker sheet — when set, the modal is visible and
  // saving toggles deck-membership for this hanzi. `ensureSaved` is the
  // first-add hook that writes the saved_words row before the membership
  // row points at a hanzi the user doesn't yet have in the master deck.
  const [saveTarget, setSaveTarget] = useState<{
    hanzi: string;
    pinyin: string;
    ensureSaved?: () => Promise<void>;
  } | null>(null);
  // Multi-select mode for bulk-tagging into a deck. Tracks the set of
  // picked hanzi across all row types (saved / HSK / dict).
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

  const [dictResults, setDictResults] = useState<DictEntry[]>([]);
  const [dictLoading, setDictLoading] = useState(false);
  const [translatedQuery, setTranslatedQuery] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<DictEntry | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const dictReqId = useRef(0);
  const aiReqId = useRef(0);

  const savedHanziSet = useMemo(
    () => new Set(saved.map((w) => w.hanzi)),
    [saved],
  );
  const dueCount = useMemo(() => {
    const now = Date.now();
    return saved.filter((w) => new Date(w.next_review_at).getTime() <= now).length;
  }, [saved]);
  const learningCount = useMemo(
    () => saved.filter((w) => w.review_count > 0 && w.review_count < 5).length,
    [saved],
  );
  const masteredCount = useMemo(
    () => saved.filter((w) => w.review_count >= 5).length,
    [saved],
  );

  // ── Data loaders ─────────────────────────────────────────────────────────
  async function reloadSaved() {
    if (!session) return;
    const data = await fetchAllWords(session.user.id);
    if (data.length === 0 || lang === "en") {
      setSaved(data);
      setSavedLoaded(true);
      return;
    }
    const map = await fetchTranslations(data.map((w) => w.hanzi), lang);
    setSaved(
      data.map((w) => {
        const translated = map[w.hanzi]?.[0];
        return translated ? { ...w, english: translated } : w;
      }),
    );
    setSavedLoaded(true);
  }

  useEffect(() => {
    reloadSaved();
    fetchTopics().then(setTopics).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, profile?.native_language]);

  useEffect(() => {
    const needsCatalog = scope === "hsk" || scope === "topic" || scope === "all";
    if (!needsCatalog || catalog.length > 0) return;
    setCatalogLoading(true);
    fetchAllCatalog()
      .then((rows) => setCatalog(rows))
      .catch(() => undefined)
      .finally(() => setCatalogLoading(false));
  }, [scope, catalog.length]);

  useEffect(() => {
    if (scope !== "topic" || !topicId) {
      setTopicHanziSet(null);
      return;
    }
    let cancelled = false;
    fetchByTopic(topicId).then((rows) => {
      if (cancelled) return;
      setTopicHanziSet(new Set(rows.map((r) => r.hanzi)));
    });
    return () => {
      cancelled = true;
    };
  }, [scope, topicId]);

  // Dictionary search — debounced.
  useEffect(() => {
    if (scope !== "all") {
      setDictResults([]);
      setAiResult(null);
      setTranslatedQuery(null);
      return;
    }
    const q = query.trim();
    if (q.length === 0) {
      setDictResults([]);
      setAiResult(null);
      setTranslatedQuery(null);
      setDictLoading(false);
      setAiLoading(false);
      return;
    }
    const myReq = ++dictReqId.current;
    setDictLoading(true);
    setAiResult(null);
    setBannerDismissed(false);

    const handle = setTimeout(async () => {
      const { results, translatedQuery: tq } = await searchDictionary(q, lang, 40);
      if (myReq !== dictReqId.current) return;
      setDictResults(results);
      setTranslatedQuery(tq);
      setDictLoading(false);
      if (results.length === 0 && q.length >= 2) {
        const myAi = ++aiReqId.current;
        setAiLoading(true);
        const ai = await aiFallbackLookup(q, lang);
        if (myAi !== aiReqId.current) return;
        setAiResult(ai);
        setAiLoading(false);
      }
    }, DICT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [scope, query, lang]);

  async function ensureMeaningsFor(hanziList: string[]) {
    const missing = hanziList.filter((h) => !(h in meanings));
    if (missing.length === 0) return;
    const map = await fetchTranslations(missing.slice(0, 40), lang);
    setMeanings((prev) => {
      const next = { ...prev };
      for (const h of missing.slice(0, 40)) {
        const v = map[h]?.[0];
        if (v) next[h] = v;
      }
      return next;
    });
  }

  // ── Row derivation ───────────────────────────────────────────────────────
  const rows = useMemo<Row[]>(() => {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const qNorm = normalizePinyin(q);
    const now = Date.now();

    const savedRows: Row[] = saved
      .filter((w) => {
        if (q) {
          const meaningMatch = w.english.toLowerCase().includes(qLower);
          const hanziMatch = w.hanzi.includes(q);
          const pinyinMatch = normalizePinyin(w.pinyin).includes(qNorm);
          if (!meaningMatch && !hanziMatch && !pinyinMatch) return false;
        }
        switch (statusFilter) {
          case "due":
            return new Date(w.next_review_at).getTime() <= now;
          case "learning":
            return w.review_count > 0 && w.review_count < 5;
          case "mastered":
            return w.review_count >= 5;
          default:
            return true;
        }
      })
      .map((w) => ({ kind: "saved" as const, word: w }));

    if (scope === "saved") return savedRows.slice(0, MAX_RESULTS);

    const candidates =
      scope === "topic" && topicHanziSet
        ? catalog.filter((w) => topicHanziSet.has(w.hanzi))
        : catalog;
    const filtered =
      scope === "all"
        ? candidates.filter((w) => !savedHanziSet.has(w.hanzi))
        : candidates;

    let hskRows: Row[];
    if (q.length === 0) {
      hskRows = filtered
        .slice(0, MAX_RESULTS)
        .map((w) => ({ kind: "hsk" as const, word: w, meaning: meanings[w.hanzi] ?? null }));
    } else {
      const scored: { row: HskWord; score: number }[] = [];
      for (const w of filtered) {
        const meaning = meanings[w.hanzi] ?? "";
        const meaningHit =
          meaning.length > 0 && meaning.toLowerCase().includes(qLower);
        const score = scoreHskMatch(w, q, qNorm, meaningHit);
        if (score >= 0) scored.push({ row: w, score });
      }
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const la = a.row.hsk_new ?? a.row.hsk_old ?? 9;
        const lb = b.row.hsk_new ?? b.row.hsk_old ?? 9;
        if (la !== lb) return la - lb;
        return a.row.hanzi.length - b.row.hanzi.length;
      });
      hskRows = scored
        .slice(0, MAX_RESULTS)
        .map(({ row }) => ({
          kind: "hsk" as const,
          word: row,
          meaning: meanings[row.hanzi] ?? null,
        }));
    }

    if (scope === "all") {
      const dictRows: Row[] = dictResults
        .filter((r) => !savedHanziSet.has(r.hanzi))
        .map((entry) => ({ kind: "dict" as const, entry }));
      const allRows: Row[] = [...savedRows, ...dictRows];
      if (allRows.length === 0 && aiResult) {
        allRows.push({ kind: "dict" as const, entry: aiResult });
      }
      return allRows.slice(0, MAX_RESULTS);
    }
    return hskRows;
  }, [
    saved,
    catalog,
    scope,
    query,
    statusFilter,
    topicHanziSet,
    meanings,
    savedHanziSet,
    dictResults,
    aiResult,
  ]);

  useEffect(() => {
    const missing = rows
      .filter((r) => r.kind === "hsk" && r.meaning === null)
      .map((r) => (r as Extract<Row, { kind: "hsk" }>).word.hanzi);
    if (missing.length > 0) void ensureMeaningsFor(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function remove(hanzi: string) {
    if (!session) return;
    const ok = await deleteWord(session.user.id, hanzi);
    if (ok) {
      setSaved((ws) => ws.filter((w) => w.hanzi !== hanzi));
      toast.info(fmt(t.vocab.browse.removed, { hanzi }));
    } else {
      toast.error(t.vocab.browse.removeError);
    }
  }
  async function add(word: HskWord) {
    if (!session) return;
    const meaning = meanings[word.hanzi] ?? "";
    const created = await addWord({
      userId: session.user.id,
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      english: meaning,
      hskLevel: word.hsk_new ?? word.hsk_old ?? 0,
    });
    if (created) {
      setSaved((ws) => [created, ...ws.filter((w) => w.hanzi !== created.hanzi)]);
      toast.info(fmt(t.vocab.browse.addedToast, { hanzi: word.hanzi }));
    } else {
      toast.error(t.vocab.browse.addError);
    }
  }
  async function addDictEntry(entry: DictEntry) {
    if (!session) return;
    const created = await addWord({
      userId: session.user.id,
      hanzi: entry.hanzi,
      pinyin: entry.pinyin,
      english: entry.meanings[0] ?? entry.meanings_en[0] ?? "",
      hskLevel: entry.hsk_level ?? 0,
    });
    if (created) {
      setSaved((ws) => [created, ...ws.filter((w) => w.hanzi !== created.hanzi)]);
      toast.info(fmt(t.vocab.browse.addedToast, { hanzi: entry.hanzi }));
    } else {
      toast.error(t.vocab.browse.addError);
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function subtitleText(): string {
    if (scope === "saved")
      return fmt(t.vocab.browse.subtitleSaved, { deck: saved.length, due: dueCount });
    if (scope === "hsk") return t.vocab.browse.subtitleHsk;
    if (scope === "topic")
      return fmt(t.vocab.browse.subtitleTopic, { n: topics.length });
    return fmt(t.vocab.browse.subtitleAll, {
      deck: saved.length,
      dict: formatThousands(TOTAL_DICT),
      hsk: formatThousands(TOTAL_HSK),
    });
  }

  const SCOPES: { id: Scope; label: string; count?: string }[] = [
    { id: "all", label: t.vocab.browse.scopeAll, count: `${formatThousands(TOTAL_DICT)}` },
    { id: "saved", label: t.vocab.browse.scopeSaved, count: `${saved.length}` },
    { id: "hsk", label: t.vocab.browse.scopeHsk, count: `${formatThousands(TOTAL_HSK)}` },
    { id: "topic", label: t.vocab.browse.scopeTopic },
  ];

  const STATUS_FILTERS: { id: StatusFilter; label: string; count: number; icon?: boolean }[] = [
    { id: "all", label: t.vocab.browse.filterAll, count: saved.length },
    { id: "due", label: t.vocab.browse.filterDue, count: dueCount, icon: true },
    { id: "learning", label: t.vocab.browse.filterLearning, count: learningCount },
    { id: "mastered", label: t.vocab.browse.filterMastered, count: masteredCount },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["6xl"],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: theme.spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.replace("/(app)/learn")}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft color={theme.colors.textPrimary} size={20} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1, gap: 2, paddingTop: 4 }}>
            <Text
              style={{
                fontSize: 22,
                lineHeight: 26,
                fontFamily: theme.fonts.uiBold,
                color: theme.colors.textPrimary,
              }}
            >
              {t.vocab.browse.title}
            </Text>
            <Text variant="small" color="tertiary" numberOfLines={1}>
              {subtitleText()}
            </Text>
          </View>
          {/* Select-mode toggle. Replaces the per-row "+" / "✓" with
              checkboxes and reveals a bulk-save dock at the bottom. */}
          <Pressable
            onPress={selectMode ? exitSelectMode : () => setSelectMode(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={selectMode ? t.common.done : t.vocab.browse.selectA11y}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: selectMode
                ? theme.colors.textPrimary
                : theme.colors.surface,
              borderWidth: 1,
              borderColor: selectMode
                ? theme.colors.textPrimary
                : theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckSquare
              color={selectMode ? "#FFFFFF" : theme.colors.textPrimary}
              size={18}
              strokeWidth={2.2}
            />
          </Pressable>
          {/* Decks library — list of user's named collections. */}
          <Pressable
            onPress={() => router.push("/(app)/vocab/decks")}
            hitSlop={12}
            accessibilityLabel={t.vocab.browse.myDecksA11y}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Library color={theme.colors.textPrimary} size={20} strokeWidth={2.2} />
          </Pressable>
          {/* Drill — funnel training. Sits left of the "+" FAB so the
              "create / practice" dyad reads as one cluster. */}
          <Pressable
            onPress={() => router.push("/(app)/vocab/drill")}
            hitSlop={12}
            accessibilityLabel={t.vocab.browse.drillA11y}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Target color={theme.colors.textPrimary} size={20} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/vocab/add")}
            hitSlop={12}
            accessibilityLabel={t.vocab.add.title}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.accent,
              alignItems: "center",
              justifyContent: "center",
              ...theme.shadows.sm,
              shadowColor: theme.colors.accent,
              shadowOpacity: 0.25,
            }}
          >
            <Plus color={theme.colors.onAccent} size={22} strokeWidth={2.6} />
          </Pressable>
        </View>

        {/* Search input */}
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              ...theme.shadows.sm,
              shadowOpacity: 0.04,
            }}
          >
            <Search color={theme.colors.textTertiary} size={18} strokeWidth={2} />
            <View style={{ flex: 1, gap: 1 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={
                  scope === "all" || scope === "hsk" || scope === "topic"
                    ? t.vocab.browse.searchPlaceholderAll
                    : t.vocab.browse.searchPlaceholder
                }
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  height: 24,
                  color: theme.colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  padding: 0,
                }}
              />
              {scope === "all" && query.length > 0 ? (
                <Text variant="caption" color="tertiary" style={{ letterSpacing: 0 }}>
                  {fmt(t.vocab.browse.searchHint, { lang })}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Scope segmented control — one beige container with a sliding
            dark indicator that animates between segments. */}
        <SegmentedScopes scopes={SCOPES} active={scope} onChange={setScope} />

        {/* Status filter chips (saved scope) */}
        {scope === "saved" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
              gap: theme.spacing.xs,
            }}
          >
            {STATUS_FILTERS.map((f) => (
              <StatusChip
                key={f.id}
                label={f.label}
                count={f.count}
                icon={f.icon}
                active={statusFilter === f.id}
                onPress={() => setStatusFilter(f.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        {/* Topic picker (topic scope) */}
        {scope === "topic" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
              gap: theme.spacing.xs,
            }}
          >
            {topics.map((tp) => {
              const label =
                tp.name[lang] ?? tp.name.en ?? Object.values(tp.name)[0] ?? tp.id;
              return (
                <StatusChip
                  key={tp.id}
                  label={label}
                  active={topicId === tp.id}
                  onPress={() => setTopicId(tp.id)}
                />
              );
            })}
          </ScrollView>
        ) : null}

        {/* Translated-query banner */}
        {scope === "all" && translatedQuery && !bannerDismissed ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 10,
                borderRadius: theme.radii.md,
                backgroundColor: "#FFE2E4",
              }}
            >
              <Text
                style={{
                  color: "#B5101F",
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {fmt(t.vocab.browse.bannerTranslated, {
                  q: translatedQuery,
                  n: dictResults.length,
                })}
              </Text>
              <Pressable
                onPress={() => setBannerDismissed(true)}
                hitSlop={12}
                accessibilityLabel={t.common.close}
              >
                <X color="#B5101F" size={18} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Continue-review hero (saved scope, has due cards) */}
        {scope === "saved" && dueCount > 0 ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}>
            <ContinueReviewCard
              dueCount={dueCount}
              onPress={() => router.push("/(app)/vocab/review")}
            />
          </View>
        ) : null}

        {/* Results section label */}
        {rows.length > 0 && !dictLoading && !aiLoading ? (
          <Text
            variant="caption"
            color="tertiary"
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.lg,
              paddingBottom: theme.spacing.xs,
              letterSpacing: 1.2,
            }}
          >
            {scope === "all"
              ? t.vocab.browse.sectionResults
              : ""}
          </Text>
        ) : null}

        {/* Results list */}
        {rows.length === 0 ? (
          <View
            style={{
              padding: theme.spacing["2xl"],
              alignItems: "center",
              gap: theme.spacing.sm,
            }}
          >
            {scope === "all" && (dictLoading || aiLoading) ? (
              <>
                <ActivityIndicator color={theme.colors.accent} />
                <Text variant="small" color="tertiary">
                  {aiLoading ? t.vocab.browse.aiThinking : t.common.loading}
                </Text>
              </>
            ) : scope !== "saved" && scope !== "all" && catalogLoading ? (
              <Text variant="body" color="secondary">
                {t.vocab.browse.catalogLoading}
              </Text>
            ) : scope === "topic" && !topicId ? (
              <Text variant="body" color="secondary">
                {t.vocab.browse.pickTopic}
              </Text>
            ) : scope === "saved" && !savedLoaded ? (
              <Text variant="body" color="secondary">
                {t.common.loading}
              </Text>
            ) : query.length === 0 && scope !== "saved" ? (
              <Text variant="body" color="secondary">
                {t.vocab.browse.typeToSearch}
              </Text>
            ) : (
              <>
                <Text variant="body" color="secondary">
                  {saved.length === 0 && scope === "saved"
                    ? t.vocab.browse.noWords
                    : query
                      ? fmt(t.vocab.browse.noResults, { q: query })
                      : t.vocab.browse.noMatch}
                </Text>
                {saved.length === 0 && scope === "saved" ? (
                  <Pressable onPress={() => router.push("/(app)/vocab/add")}>
                    <Text variant="bodyStrong" color="accent">
                      {t.vocab.browse.addFirst}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              gap: theme.spacing.sm,
            }}
          >
            {rows.map((item) => {
              if (item.kind === "saved") {
                const hanzi = item.word.hanzi;
                return (
                  <WordRow
                    key={`s:${hanzi}`}
                    hanzi={hanzi}
                    pinyin={item.word.pinyin}
                    meaning={item.word.english}
                    hsk={item.word.hsk_level}
                    saved={true}
                    due={new Date(item.word.next_review_at).getTime() <= Date.now()}
                    reps={item.word.review_count}
                    selectMode={selectMode}
                    selected={selectedHanzi.has(hanzi)}
                    onPress={() =>
                      selectMode
                        ? toggleSelected(hanzi)
                        : setDetail({
                            hanzi,
                            pinyin: item.word.pinyin,
                            english: item.word.english,
                            hskLevel: item.word.hsk_level,
                            contextSentence: item.word.context_sentence,
                          })
                    }
                    onAction={() =>
                      selectMode ? toggleSelected(hanzi) : remove(hanzi)
                    }
                  />
                );
              }
              if (item.kind === "hsk") {
                const hsk = item.word.hsk_new ?? item.word.hsk_old ?? 0;
                const saved = savedHanziSet.has(item.word.hanzi);
                const hanzi = item.word.hanzi;
                return (
                  <WordRow
                    key={`h:${hanzi}`}
                    hanzi={hanzi}
                    pinyin={item.word.pinyin}
                    meaning={item.meaning ?? "…"}
                    hsk={hsk}
                    saved={saved}
                    selectMode={selectMode}
                    selected={selectedHanzi.has(hanzi)}
                    onPress={() =>
                      selectMode
                        ? toggleSelected(hanzi)
                        : setDetail({
                            hanzi,
                            pinyin: item.word.pinyin,
                            english: item.meaning ?? "",
                            hskLevel: hsk,
                          })
                    }
                    onAction={() =>
                      selectMode
                        ? toggleSelected(hanzi)
                        : setSaveTarget({
                            hanzi,
                            pinyin: item.word.pinyin,
                            ensureSaved: saved
                              ? undefined
                              : async () => {
                                  await add(item.word);
                                },
                          })
                    }
                  />
                );
              }
              const saved = savedHanziSet.has(item.entry.hanzi);
              const hanzi = item.entry.hanzi;
              return (
                <WordRow
                  key={`d:${hanzi}`}
                  hanzi={hanzi}
                  pinyin={item.entry.pinyin}
                  meaning={
                    item.entry.meanings.slice(0, 2).join(" · ") ||
                    item.entry.meanings_en.slice(0, 2).join(" · ") ||
                    "—"
                  }
                  hsk={item.entry.hsk_level ?? 0}
                  saved={saved}
                  ai={item.entry.source === "ai"}
                  selectMode={selectMode}
                  selected={selectedHanzi.has(hanzi)}
                  onPress={() =>
                    selectMode
                      ? toggleSelected(hanzi)
                      : setDetail({
                          hanzi,
                          pinyin: item.entry.pinyin,
                          english: item.entry.meanings[0] ?? "",
                          meanings: item.entry.meanings,
                          hskLevel: item.entry.hsk_level,
                        })
                  }
                  onAction={() =>
                    selectMode
                      ? toggleSelected(hanzi)
                      : setSaveTarget({
                          hanzi,
                          pinyin: item.entry.pinyin,
                          ensureSaved: saved
                            ? undefined
                            : async () => {
                                await addDictEntry(item.entry);
                              },
                    })
                  }
                />
              );
            })}
          </View>
        )}

        {/* Footer "AI badge" explanation */}
        {scope === "all" && rows.some((r) => r.kind === "dict" && r.entry.source === "ai") ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <View
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text variant="small" color="secondary">
                {t.vocab.browse.footerAiHint}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <WordDetailSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        word={detail}
        isSaved={detail ? savedHanziSet.has(detail.hanzi) : undefined}
        onSave={
          detail && !savedHanziSet.has(detail.hanzi)
            ? () => {
                addDictEntry({
                  hanzi: detail.hanzi,
                  pinyin: detail.pinyin,
                  meanings: detail.meanings ?? [detail.english],
                  meanings_en: [],
                  hsk_level: detail.hskLevel ?? null,
                  freq: null,
                  score: 0,
                  source_lang: "en",
                });
              }
            : undefined
        }
        onDelete={
          detail && savedHanziSet.has(detail.hanzi)
            ? () => {
                remove(detail.hanzi);
                setDetail(null);
              }
            : undefined
        }
      />

      {/* Inline save-to-deck modal. Opened by tapping the "+" icon on any
          unsaved row (HSK / dict) — the modal handles deck creation and the
          word's first-add to saved_words via the `ensureSaved` callback. */}
      <SaveToDeckSheet
        visible={saveTarget !== null}
        onClose={() => setSaveTarget(null)}
        hanzi={saveTarget?.hanzi ?? ""}
        pinyin={saveTarget?.pinyin}
        onFirstAdd={saveTarget?.ensureSaved}
      />

      {/* Select-mode floating action bar — pops in when a multi-pick is
          active. The "В колоду" button opens BulkSaveToDeckSheet with the
          full picked set. Sits absolute over the bottom so the scroll list
          isn't reflowed every time the user (de)selects a row. */}
      {selectMode ? (
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
              {fmt(
                selectedHanzi.size === 1 ? t.vocab.wordsCountOne : t.vocab.wordsCountOther,
                { n: selectedHanzi.size },
              )}
            </Text>
            <Text variant="caption" color="tertiary">
              {t.vocab.browse.selectedLabel}
            </Text>
          </View>
          <Pressable
            onPress={exitSelectMode}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 10,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text variant="bodyStrong" color="secondary">
              {t.common.cancel}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBulkSaveOpen(true)}
            disabled={selectedHanzi.size === 0}
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 11,
              borderRadius: 999,
              backgroundColor: theme.colors.accent,
              opacity:
                selectedHanzi.size === 0 ? 0.45 : pressed ? 0.92 : 1,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
              {t.vocab.browse.toDeck}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <BulkSaveToDeckSheet
        visible={bulkSaveOpen}
        onClose={() => setBulkSaveOpen(false)}
        hanziList={Array.from(selectedHanzi)}
        onEnsureSaved={async (hanziList) => {
          // For each picked hanzi, find its source row and write to
          // saved_words if it isn't already there. Saved-row hanzi already
          // sit in saved_words so we skip them; HSK / dict rows need the
          // proper add* call so the meaning/HSK level get persisted.
          for (const h of hanziList) {
            if (savedHanziSet.has(h)) continue;
            const row = rows.find((r) =>
              r.kind === "saved"
                ? r.word.hanzi === h
                : r.kind === "hsk"
                  ? r.word.hanzi === h
                  : r.entry.hanzi === h,
            );
            if (!row) continue;
            if (row.kind === "hsk") await add(row.word);
            else if (row.kind === "dict") await addDictEntry(row.entry);
          }
        }}
        onSaved={() => exitSelectMode()}
      />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function formatThousands(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(k >= 100 ? 0 : 1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

/**
 * Primary scope selector — one continuous warm-beige container holding
 * variable-width segments and an absolutely-positioned dark indicator
 * that spring-slides (and resizes) between them as the user taps.
 *
 * Labels stay single-line via numberOfLines={1}, and the whole control is
 * wrapped in a horizontal ScrollView so that adding more scopes in the
 * future never causes a height jump — instead the bar simply scrolls.
 *
 * Inactive labels use ink-2; the active segment paints white text on a
 * #1A1614 indicator, matching mock 13.
 */
function SegmentedScopes({
  scopes,
  active,
  onChange,
}: {
  scopes: { id: Scope; label: string; count?: string }[];
  active: Scope;
  onChange: (id: Scope) => void;
}) {
  const theme = useTheme();
  const PAD = 4;
  const [layouts, setLayouts] = useState<
    Array<{ x: number; width: number } | undefined>
  >([]);
  const activeIndex = Math.max(
    0,
    scopes.findIndex((s) => s.id === active),
  );
  const activeLayout = layouts[activeIndex];
  const translateX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const hasAnimatedOnce = useRef(false);

  useEffect(() => {
    if (!activeLayout) return;
    if (!hasAnimatedOnce.current) {
      // Snap on first paint to avoid a slide-in from 0 on mount.
      translateX.setValue(activeLayout.x);
      indicatorWidth.setValue(activeLayout.width);
      hasAnimatedOnce.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: activeLayout.x,
        useNativeDriver: false,
        friction: 9,
        tension: 90,
      }),
      Animated.spring(indicatorWidth, {
        toValue: activeLayout.width,
        useNativeDriver: false,
        friction: 9,
        tension: 90,
      }),
    ]).start();
  }, [activeLayout?.x, activeLayout?.width, translateX, indicatorWidth]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#F5F1EA",
          borderRadius: theme.radii.md,
          padding: PAD,
          position: "relative",
          alignSelf: "flex-start",
        }}
      >
        {activeLayout ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: PAD,
              bottom: PAD,
              left: 0,
              width: indicatorWidth,
              backgroundColor: "#1A1614",
              borderRadius: theme.radii.sm,
              transform: [{ translateX }],
            }}
          />
        ) : null}
        {scopes.map((s, i) => {
          const isActive = s.id === active;
          return (
            <Pressable
              key={s.id}
              onPress={() => onChange(s.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onLayout={(e) => {
                const { x, width: w } = e.nativeEvent.layout;
                setLayouts((prev) => {
                  if (prev[i]?.x === x && prev[i]?.width === w) return prev;
                  const next = prev.slice();
                  next[i] = { x, width: w };
                  return next;
                });
              }}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                minWidth: 84,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: isActive ? "#FFFFFF" : "#524A42",
                  fontSize: 14,
                  fontFamily: theme.fonts.uiBold,
                }}
              >
                {s.label}
              </Text>
              {s.count ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: isActive ? "rgba(255,255,255,0.65)" : "#8A847C",
                    fontSize: 11,
                    lineHeight: 14,
                    marginTop: 1,
                    fontFamily: theme.fonts.pinyinMono,
                  }}
                >
                  {s.count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/**
 * Secondary chip — rounded pill used for status filters under the Saved
 * scope and as topic chips. Two-state visual:
 *   Inactive — white surface with a warm border (--border #ECE7DE), label
 *              in --ink-2.
 *   Active   — light red fill (--red-100 #FFE2E4) with red ink-1 label
 *              and a filled flame icon when the chip carries one (К сроку).
 */
function StatusChip({
  label,
  count,
  icon,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  icon?: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const fg = active ? "#C8102E" : "#524A42";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: theme.radii.full,
        backgroundColor: active ? "#FFE2E4" : "#FFFFFF",
        borderWidth: active ? 0 : 1,
        borderColor: "#ECE7DE",
      }}
    >
      {icon ? (
        <Flame
          color={fg}
          size={14}
          strokeWidth={2.4}
          fill={active ? fg : "transparent"}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          color: fg,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
        }}
      >
        {label}
        {typeof count === "number" ? ` · ${count}` : ""}
      </Text>
    </Pressable>
  );
}

/**
 * Dark-burgundy hero card encouraging the user to start their SRS
 * session. Same poster-style language as the Home hero — anchored by a
 * faint hanzi watermark and a glowing radial.
 */
function ContinueReviewCard({
  dueCount,
  onPress,
}: {
  dueCount: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const estimatedMin = Math.max(1, Math.ceil(dueCount * 0.75));
  const xp = dueCount * 3;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.vocab.browse.continueTitle}
      style={({ pressed }) => ({
        backgroundColor: "#1F0C10",
        borderRadius: theme.radii.lg,
        padding: theme.spacing.md,
        overflow: "hidden",
        opacity: pressed ? 0.95 : 1,
        ...theme.shadows.md,
        shadowColor: "#000",
        shadowOpacity: 0.18,
      })}
    >
      <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="reviewGlow" cx="80%" cy="40%" r="70%">
              <Stop offset="0%" stopColor="#5A1C22" stopOpacity={0.9} />
              <Stop offset="60%" stopColor="#5A1C22" stopOpacity={0.22} />
              <Stop offset="100%" stopColor="#5A1C22" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill="url(#reviewGlow)" />
        </Svg>
      </View>
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -40,
          bottom: -60,
          fontSize: 220,
          lineHeight: 220,
          fontWeight: "900",
          color: "rgba(255, 80, 90, 0.08)",
        }}
      >
        复
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 18, lineHeight: 22 }}>▶</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 17, lineHeight: 22, fontWeight: "800" }}>
            {t.vocab.browse.continueTitle}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 18 }}>
            {fmt(t.vocab.browse.continueSubtitle, {
              n: dueCount,
              min: estimatedMin,
              xp,
            })}
          </Text>
        </View>
        <ChevronRight color="rgba(255,255,255,0.55)" size={20} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

/**
 * Unified word row. Renders both saved deck entries and catalog/dictionary
 * results — the visual is identical aside from the right-side action icon
 * (green ✓ for saved, red + for unsaved, grey × for deletable saved
 * entries). Layout: large serif hanzi on the left + multi-line pinyin →
 * meaning column → coloured badges row → action button.
 */
function WordRow({
  hanzi,
  pinyin,
  meaning,
  hsk,
  saved,
  due,
  reps,
  ai,
  selectMode = false,
  selected = false,
  onPress,
  onAction,
}: {
  hanzi: string;
  pinyin: string;
  meaning: string;
  hsk: number;
  saved: boolean;
  due?: boolean;
  reps?: number;
  ai?: boolean;
  /** If true, the trailing slot shows a checkbox and tapping the row
   *  toggles selection (caller wires that via onPress). */
  selectMode?: boolean;
  selected?: boolean;
  onPress: () => void;
  onAction?: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const hskTone = HSK_PILL[hsk] ?? null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hanzi}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ minWidth: 64, alignItems: "flex-start" }}>
        <TonedPinyin pinyin={pinyin} />
        <Text
          style={{
            fontSize: 34,
            lineHeight: 40,
            fontFamily: theme.fonts.chineseSerif,
            color: theme.colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {hanzi}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: "500",
          }}
          numberOfLines={2}
        >
          {meaning}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {hsk > 0 && hskTone ? (
            <MiniBadge
              text={fmt(t.vocab.browse.hskBadge, { n: hsk })}
              bg={hskTone.bg}
              fg={hskTone.fg}
            />
          ) : null}
          {saved ? (
            <MiniBadge
              text={`✓ ${t.vocab.browse.inDeckBadge}`}
              bg="#DCEEDB"
              fg="#1F8A5B"
            />
          ) : null}
          {due ? (
            <MiniBadge text={t.vocab.browse.dueChip} bg="#FCE4E6" fg="#C8102E" />
          ) : null}
          {typeof reps === "number" && reps > 0 ? (
            <MiniBadge
              text={fmt(t.vocab.browse.repsBadge, { n: reps })}
              bg={theme.colors.surfaceHover}
              fg={theme.colors.textSecondary}
            />
          ) : null}
          {ai ? <MiniBadge text="AI" bg="#EBE2FB" fg="#7A48D6" /> : null}
        </View>
      </View>
      {selectMode ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onAction?.();
          }}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: selected ? theme.colors.accent : "transparent",
            borderWidth: selected ? 0 : 1.5,
            borderColor: theme.colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? <Check color="#FFFFFF" size={14} strokeWidth={3} /> : null}
        </Pressable>
      ) : (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onAction?.();
          }}
          disabled={!onAction}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: saved
              ? "#DCEEDB"
              : onAction
                ? theme.colors.accentMuted
                : theme.colors.surfaceHover,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              lineHeight: 22,
              fontWeight: "800",
              color: saved ? "#1F8A5B" : theme.colors.accent,
            }}
          >
            {saved ? "✓" : "+"}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/**
 * Pinyin rendered with per-syllable tone colours, in the brand mono font.
 * Used in word-list rows where the small text otherwise blends into a
 * single blue stripe. Each syllable picks up its tone1..4 / neutral tint
 * from the active theme so dark/light themes stay consistent.
 */
function TonedPinyin({ pinyin }: { pinyin: string }) {
  const theme = useTheme();
  const TONE_COLOR: Record<0 | 1 | 2 | 3 | 4, string> = {
    1: theme.colors.tone1,
    2: theme.colors.tone2,
    3: theme.colors.tone3,
    4: theme.colors.tone4,
    0: theme.colors.toneNeutral,
  };
  const syllables = splitSyllables(pinyin);
  if (syllables.length === 0) return null;
  return (
    <Text
      style={{
        fontSize: 13,
        lineHeight: 16,
        fontFamily: theme.fonts.pinyinMono,
        letterSpacing: 0,
      }}
      numberOfLines={1}
    >
      {syllables.map((sy, i) => (
        <Text
          key={`${sy}-${i}`}
          style={{
            color: TONE_COLOR[detectTone(sy)],
            fontFamily: theme.fonts.pinyinMono,
          }}
        >
          {i > 0 ? " " : ""}
          {sy}
        </Text>
      ))}
    </Text>
  );
}

function MiniBadge({
  text,
  bg,
  fg,
}: {
  text: string;
  bg: string;
  fg: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 10,
          lineHeight: 14,
          fontFamily: theme.fonts.uiBold,
          letterSpacing: 0.3,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
