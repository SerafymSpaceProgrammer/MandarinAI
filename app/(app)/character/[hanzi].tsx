import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mic,
  Play,
  Square,
  Star,
  Volume2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Button, Screen, Text, useToast } from "@/components/ui";
import { StrokeAnimator } from "@/components/StrokeAnimator";
import { StrokeQuiz, type StrokeQuizHandle } from "@/components/StrokeQuiz";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import {
  advanceStep,
  fetchDict,
  fetchOneFromDict,
  fetchUserCharacter,
  type CharacterDictRow,
  type UserCharacter,
} from "@/features/character/character";
import { useLocalizedCharacter } from "@/features/character/translate";
import {
  fetchTranslations,
  fetchWordsContaining,
  type HskWord,
} from "@/features/hsk/hsk";
import { WordDetailSheet, type WordDetail } from "@/components/cards/WordDetailSheet";
import { recordActivity } from "@/features/activity/activity";
import {
  cancelActiveRecording,
  ensureMicPermission,
  startRecording,
} from "@/features/speaking/recorder";
import { scorePronunciation, type PronunciationResult } from "@/features/speaking/score";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

// Brand palette — inline so the screen is pixel-traceable against mock 20a
// without hopping files for the brand HEX values.
const C_PAPER = "#FAFAF7";
const C_SURFACE = "#FFFFFF";
const C_WARM = "#F5F1EA";
const C_BORDER = "#ECE7DE";
const C_INK = "#1A1614";
const C_INK_2 = "#524A42";
const C_INK_3 = "#8A847C";
const C_RED = "#E63946";
const C_RED_DEEP = "#C8102E";
const C_RED_100 = "#FFE2E4";
const C_RED_GRID = "#F8CCCC"; // dashed tian-zi-ge guides
const C_GREEN = "#1F8A5B";
const C_AMBER_TILE = "#FEF3D9";
const C_AMBER_INK = "#A85B00";
const C_GOLD_TILE = "#FFF1D6";
const C_GOLD = "#E0B86A";

type StepDef = {
  /** 1-indexed for display ("1. Learn"). Matches `step_completed` semantics:
   *  step `id=N` is considered done when `step_completed >= N`. */
  id: number;
  /** English label per the mock; kept in EN to match the design language. */
  label: string;
  /** i18n key (in `character.*`) of the hint under the label. */
  hintKey: keyof Translations["character"];
  /** Representative hanzi rendered on the active/pending tile. */
  icon: string;
};

const STEPS: StepDef[] = [
  { id: 1, label: "Learn", hintKey: "stepLearnHint", icon: "学" },
  { id: 2, label: "Recognize", hintKey: "stepRecognizeHint", icon: "认" },
  { id: 3, label: "Pronounce", hintKey: "stepPronounceHint", icon: "读" },
  { id: 4, label: "Write", hintKey: "stepWriteHint", icon: "写" },
  { id: 5, label: "Produce", hintKey: "stepProduceHint", icon: "说" },
];

// Per-step inline header copy + "next step" CTA label. Keeps the hub
// architecture: each step lives in its own inline view with the brand
// "HSK X · STEP N / 5 · STEP_NAME" eyebrow + a per-step task title. The
// next-label drives the bottom CTA so the chain reads "To pronunciation →"
// after Recognize, "To writing →" after Pronounce, etc.
function stepMeta(
  t: Translations,
): Record<number, { eyebrow: string; title: string; nextLabel: string }> {
  return {
    2: {
      eyebrow: t.character.recogEyebrow,
      title: t.character.recogTitle,
      nextLabel: t.character.recogNext,
    },
    3: {
      eyebrow: t.character.pronEyebrow,
      title: t.character.pronTitle,
      nextLabel: t.character.pronNext,
    },
    4: {
      eyebrow: t.character.writeEyebrow,
      title: t.character.writeTitle,
      nextLabel: t.character.writeNext,
    },
    5: {
      eyebrow: t.character.prodEyebrow,
      title: t.character.prodTitle,
      nextLabel: t.character.prodNext,
    },
  };
}

function localizedStepLabels(t: Translations): readonly string[] {
  return [
    t.character.stepLearn,
    t.character.stepRecognize,
    t.character.stepPronounce,
    t.character.stepWrite,
    t.character.stepProduce,
  ];
}

export default function CharacterDetail() {
  const theme = useTheme();
  const t = useT();
  const session = useUserStore((s) => s.session);
  const STEP_LABELS = localizedStepLabels(t);
  const params = useLocalSearchParams<{ hanzi: string }>();
  const hanzi = decodeURIComponent(params.hanzi ?? "");

  const [loading, setLoading] = useState(true);
  const [dict, setDict] = useState<CharacterDictRow | null>(null);
  const [distractors, setDistractors] = useState<CharacterDictRow[]>([]);
  const [progress, setProgress] = useState<UserCharacter | null>(null);

  // step_completed semantics: 0 = never visited, 1..5 = step N done, 5 = mastered.
  // Hub view shows "next uncompleted" step (= step_completed + 1) as the active
  // card. When the user taps Начать on the active card we render the matching
  // inline step view — same components as the old sequential flow, just driven
  // by the hub rather than auto-advancing on each completion.
  const [stepIdx, setStepIdx] = useState(0);
  const [inlineStep, setInlineStep] = useState<number | null>(null);

  useEffect(() => {
    if (!session || !hanzi) return;
    let cancelled = false;
    (async () => {
      const [row, userRow, pool] = await Promise.all([
        fetchOneFromDict(hanzi),
        fetchUserCharacter(session.user.id, hanzi),
        fetchDict(1),
      ]);
      if (cancelled) return;
      setDict(row);
      setProgress(userRow);
      setStepIdx(userRow?.step_completed ?? 0);
      setDistractors(pool.filter((c) => c.hanzi !== hanzi));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, hanzi]);

  // Auto-complete Learn (step 0 → 1) on first visit. The new "info hub" view
  // IS the Learn step — just being on this screen IS the introduction. No
  // explicit "Got it" button is needed since the same content stays visible
  // when the user moves through Recognize/Pronounce/Write/Produce.
  useEffect(() => {
    if (!session || loading || !dict) return;
    if (stepIdx === 0) {
      void complete(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, dict, stepIdx, session]);

  const complete = useCallback(
    async (step: number, options: { asCorrect?: boolean } = {}) => {
      if (!session) return;
      const nextStep = step + 1;
      const row = await advanceStep(session.user.id, hanzi, nextStep);
      if (row) {
        setProgress(row);
        setStepIdx(Math.min(nextStep, 5));
      }
      recordActivity(session.user.id, {
        characters_learned: nextStep >= 5 && step === 4 ? 1 : 0,
        xp_earned: options.asCorrect ? 3 : 2,
      });
    },
    [session, hanzi],
  );

  function startInlineStep(id: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInlineStep(id);
  }

  function closeInlineStep() {
    setInlineStep(null);
  }

  async function handleStepDone(stepId: number, asCorrect: boolean) {
    await complete(stepId - 1, { asCorrect });
    // Auto-chain into the next step's inline view so the user keeps the
    // momentum from the "К произношению →" / "К написанию →" CTAs in the
    // mocks. They can always tap ✕ in the inline header to bail back to
    // the hub mid-chain.
    const nextId = stepId + 1;
    if (nextId <= 5) {
      setInlineStep(nextId);
    } else {
      setInlineStep(null);
    }
  }

  if (loading || !dict) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C_RED} />
        </View>
      </Screen>
    );
  }

  // ── Inline step render ─────────────────────────────────────────────
  if (inlineStep !== null) {
    const meta = stepMeta(t)[inlineStep] ?? {
      eyebrow: (STEP_LABELS[inlineStep - 1] ?? "").toUpperCase(),
      title: STEPS[inlineStep - 1]?.label ?? "",
      nextLabel: t.common.continue,
    };
    return (
      <InlineStepShell
        stepId={inlineStep}
        hskLevel={dict.hsk_level}
        eyebrow={meta.eyebrow}
        title={meta.title}
        onClose={closeInlineStep}
      >
        {inlineStep === 2 ? (
          <RecognizeStep
            dict={dict}
            distractors={distractors}
            nextLabel={meta.nextLabel}
            onResult={(correct) => void handleStepDone(2, correct)}
          />
        ) : inlineStep === 3 ? (
          <PronounceStep
            dict={dict}
            nextLabel={meta.nextLabel}
            onAdvance={(asCorrect) => void handleStepDone(3, asCorrect)}
          />
        ) : inlineStep === 4 ? (
          <WriteStub
            dict={dict}
            nextLabel={meta.nextLabel}
            onDone={(asCorrect) => void handleStepDone(4, asCorrect)}
          />
        ) : inlineStep === 5 ? (
          <ProduceStep
            dict={dict}
            distractors={distractors}
            onResult={(correct) => void handleStepDone(5, correct)}
          />
        ) : null}
      </InlineStepShell>
    );
  }

  // ── Mastered celebration ───────────────────────────────────────────
  const mastered = stepIdx >= 5;
  if (mastered) {
    // Next character to suggest = first in the frequency-ordered pool with a
    // higher rank than the one just mastered (falls back to the pool head).
    const rank = dict.frequency_rank ?? Number.MAX_SAFE_INTEGER;
    const nextChar =
      distractors.find(
        (d) => (d.frequency_rank ?? Number.MAX_SAFE_INTEGER) > rank,
      ) ??
      distractors[0] ??
      null;
    return (
      <MasteredCelebration
        dict={dict}
        progress={progress}
        nextChar={nextChar}
        onClose={() => router.back()}
        onNext={
          nextChar
            ? () =>
                router.replace(
                  `/(app)/character/${encodeURIComponent(nextChar.hanzi)}`,
                )
            : null
        }
      />
    );
  }

  // ── Hub render ─────────────────────────────────────────────────────
  // Active step in hub = first uncompleted (>= 1, since 0 auto-completes).
  const activeStepId = Math.max(1, stepIdx + 1);
  const dueLabel =
    progress?.due_at != null ? formatDate(progress.due_at, t) : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["6xl"],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar — back / hsk-eyebrow / favourite star */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel={t.common.back}
            style={{ padding: 4 }}
          >
            <ArrowLeft color={C_INK_2} size={20} strokeWidth={2.2} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              color: C_INK,
              fontSize: 15,
              lineHeight: 18,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {dict.hsk_level != null
              ? fmt(t.character.detailHeader, { n: dict.hsk_level })
              : t.character.detailHeaderUnknown}
          </Text>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: C_GOLD_TILE,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Star color={C_AMBER_INK} size={18} strokeWidth={2.2} fill={C_AMBER_INK} />
          </View>
        </View>

        {/* Info card — pinyin + meta chips + meanings + tian-zi-ge glyph */}
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <HanziInfoCard dict={dict} />
        </View>

        {/* Освоение section header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <View
            style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: C_RED }}
          />
          <Text
            style={{
              color: C_INK,
              fontSize: 13,
              lineHeight: 16,
              letterSpacing: 1.2,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.character.masteryLabel}
          </Text>
          <View style={{ flex: 1 }} />
          <Text
            style={{
              color: C_INK_3,
              fontSize: 12,
              lineHeight: 16,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {stepIdx} / 5
            {dueLabel ? fmt(t.character.reviewSuffix, { when: dueLabel }) : ""}
          </Text>
        </View>

        {/* Steps list */}
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}>
          {STEPS.map((s) => {
            const status: StepStatus =
              s.id <= stepIdx
                ? "completed"
                : s.id === activeStepId
                  ? "active"
                  : "pending";
            return (
              <StepItem
                key={s.id}
                step={s}
                status={status}
                onStart={() => startInlineStep(s.id)}
              />
            );
          })}
        </View>

        {/* Compound-words block — kept from old layout but moved below the
            step list so the hub stays compact above the fold. */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
          }}
        >
          <CompoundsBlock char={dict.hanzi} />
        </View>

        {/* SRS line at the bottom — kept for parity with the old screen */}
        {progress && progress.reps > 0 ? (
          <Text
            style={{
              textAlign: "center",
              color: C_INK_3,
              fontSize: 12,
              marginTop: theme.spacing.lg,
              paddingHorizontal: theme.spacing.lg,
            }}
          >
            {fmt(t.character.repsLine, {
              reps: progress.reps,
              when: formatDate(progress.due_at, t),
            })}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mastered celebration — mock 20f
// ─────────────────────────────────────────────────────────────────────────────

function MasteredCelebration({
  dict,
  progress,
  nextChar,
  onClose,
  onNext,
}: {
  dict: CharacterDictRow;
  progress: UserCharacter | null;
  nextChar: CharacterDictRow | null;
  onClose: () => void;
  onNext: (() => void) | null;
}) {
  const theme = useTheme();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.native_language ?? "en");
  const localized = useLocalizedCharacter(
    dict.hanzi,
    dict.meanings,
    dict.mnemonic_en,
    lang,
  );
  const meaning = localized.meanings[0] ?? "";
  const dueLabel =
    progress?.due_at != null ? formatDate(progress.due_at, t) : null;

  // Decorative confetti dots scattered around the medallion. Fixed positions
  // (no animation) — cheap and reads as celebration without a particle lib.
  const confetti: { top: number; left: number; size: number; color: string }[] = [
    { top: 10, left: 30, size: 8, color: C_RED },
    { top: 26, left: 250, size: 6, color: C_GOLD },
    { top: 70, left: 12, size: 6, color: C_GOLD },
    { top: 60, left: 280, size: 9, color: C_RED },
    { top: 150, left: 24, size: 7, color: C_RED },
    { top: 168, left: 270, size: 6, color: C_GOLD },
    { top: 200, left: 60, size: 6, color: C_GOLD },
    { top: 196, left: 240, size: 8, color: C_RED },
  ];

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing["6xl"],
        gap: theme.spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar — just a close button on the right */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingTop: theme.spacing.md,
        }}
      >
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel={t.common.close}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: C_SURFACE,
            borderWidth: 1,
            borderColor: C_BORDER,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color={C_INK_2} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* New-mastery pill */}
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: C_INK,
          }}
        >
          <Text style={{ fontSize: 13 }}>🏆</Text>
          <Text
            style={{
              color: C_GOLD,
              fontSize: 12,
              letterSpacing: 1.2,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.character.newMasteryLabel}
          </Text>
        </View>
      </View>

      {/* Medallion + confetti */}
      <View
        style={{
          height: 240,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {confetti.map((c, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: c.top,
              left: c.left,
              width: c.size,
              height: c.size,
              borderRadius: c.size / 2,
              backgroundColor: c.color,
              opacity: 0.85,
            }}
          />
        ))}
        <View style={{ width: 180, height: 180 }}>
          <View
            style={{
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: "#FFFDF7",
              borderWidth: 4,
              borderColor: C_GOLD,
              alignItems: "center",
              justifyContent: "center",
              ...theme.shadows.md,
              shadowColor: C_GOLD,
              shadowOpacity: 0.25,
            }}
          >
            <Text
              chinese
              style={{
                color: C_RED,
                fontSize: 96,
                lineHeight: 110,
                fontFamily: theme.fonts.chineseSerifBlack,
              }}
            >
              {dict.hanzi}
            </Text>
          </View>
          <View
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: C_GREEN,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 4,
              borderColor: C_PAPER,
            }}
          >
            <Check color="#FFFFFF" size={22} strokeWidth={3} />
          </View>
        </View>
      </View>

      {/* Title + reading */}
      <View style={{ alignItems: "center", gap: 8 }}>
        <Text
          style={{
            color: C_INK,
            fontSize: 28,
            lineHeight: 32,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.character.masteredBody}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text
            chinese
            style={{
              color: C_RED,
              fontSize: 22,
              lineHeight: 26,
              fontFamily: theme.fonts.chineseSerif,
            }}
          >
            {dict.hanzi}
          </Text>
          <Text
            style={{
              color: C_INK_2,
              fontSize: 16,
              fontFamily: theme.fonts.pinyinMono,
            }}
          >
            {dict.pinyin[0] ?? ""}
          </Text>
          {meaning ? (
            <Text style={{ color: C_INK_3, fontSize: 15 }}>· {meaning}</Text>
          ) : null}
        </View>
      </View>

      {/* SRS line */}
      {dueLabel ? (
        <Text
          style={{
            textAlign: "center",
            color: C_INK_2,
            fontSize: 13,
            lineHeight: 19,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          {t.character.srsComeBackPrefix}
          <Text style={{ color: C_INK, fontFamily: theme.fonts.uiBold }}>
            {dueLabel}
          </Text>
          {t.character.srsComeBackSuffix}
        </Text>
      ) : null}

      {/* Stats row */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: C_SURFACE,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C_BORDER,
          paddingVertical: theme.spacing.md,
        }}
      >
        <CelebrationStat label={t.character.celebStatSteps} value="5/5" />
        <CelebrationDivider />
        <CelebrationStat
          label={t.character.celebStatReps}
          value={String(progress?.reps ?? 0)}
        />
        <CelebrationDivider />
        <CelebrationStat
          label={t.character.celebStatStrokes}
          value={dict.stroke_count != null ? String(dict.stroke_count) : "—"}
        />
      </View>

      {/* Compounds */}
      <CompoundsBlock char={dict.hanzi} />

      {/* Bottom actions */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: C_SURFACE,
            borderWidth: 1,
            borderColor: C_BORDER,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: C_INK,
              fontSize: 15,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {t.character.backToMap}
          </Text>
        </Pressable>
        {onNext && nextChar ? (
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={fmt(t.character.nextCharA11y, { hanzi: nextChar.hanzi })}
            style={({ pressed }) => ({
              flex: 2,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: C_RED,
              opacity: pressed ? 0.92 : 1,
              ...theme.shadows.sm,
              shadowColor: C_RED,
              shadowOpacity: 0.3,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                lineHeight: 20,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {t.common.next}
            </Text>
            <Text
              chinese
              style={{
                color: "#FFFFFF",
                fontSize: 18,
                lineHeight: 20,
                fontFamily: theme.fonts.chineseSerif,
              }}
            >
              {nextChar.hanzi}
            </Text>
            <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.6} />
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function CelebrationStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={{
          color: C_INK,
          fontSize: 18,
          lineHeight: 22,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: C_INK_3,
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 1,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function CelebrationDivider() {
  return <View style={{ width: 1, backgroundColor: C_BORDER, marginVertical: 4 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub sub-components
// ─────────────────────────────────────────────────────────────────────────────

function HanziInfoCard({ dict }: { dict: CharacterDictRow }) {
  const t = useT();
  const theme = useTheme();
  const lang = useUserStore((s) => s.profile?.native_language ?? "en");
  const localized = useLocalizedCharacter(
    dict.hanzi,
    dict.meanings,
    dict.mnemonic_en,
    lang,
  );
  const [showAnimation, setShowAnimation] = useState(false);

  const speak = useCallback(() => {
    Speech.stop().catch(() => {});
    Speech.speak(dict.hanzi, { language: "zh-CN", rate: 0.85 });
  }, [dict.hanzi]);

  // Autoplay TTS on mount — matches the previous LearnStep behaviour.
  useEffect(() => {
    const id = setTimeout(() => speak(), 250);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
  }, [speak]);

  const strokeCount = dict.stroke_count ?? 0;
  const freqRank = dict.frequency_rank;
  const meanings = localized.meanings.slice(0, 3).join(" · ");

  return (
    <View
      style={{
        backgroundColor: C_SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C_BORDER,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      {/* Top row — pinyin + meta chips */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Pressable
          onPress={speak}
          hitSlop={6}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Text
            style={{
              color: C_RED,
              fontSize: 18,
              lineHeight: 22,
              fontFamily: theme.fonts.uiBold,
              letterSpacing: 0.5,
            }}
          >
            {dict.pinyin[0] ?? ""}
          </Text>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: C_RED_100,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Volume2 color={C_RED} size={12} strokeWidth={2.4} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }} />
        {strokeCount > 0 ? (
          <MetaChip text={fmt(t.character.strokesChip, { n: strokeCount })} bg={C_WARM} fg={C_INK_2} />
        ) : null}
        {freqRank != null ? (
          <MetaChip text={`#${freqRank} FREQ`} bg={C_RED_100} fg={C_RED_DEEP} />
        ) : null}
      </View>

      {/* Meanings */}
      {meanings ? (
        <Text
          style={{
            color: C_INK_3,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          {meanings}
        </Text>
      ) : null}

      {/* Tian-zi-ge grid with the giant character */}
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 240,
            height: 240,
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Outer square — dashed pink */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: C_RED_GRID,
              borderRadius: 2,
            }}
          />
          {/* Horizontal mid-line */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              borderTopWidth: 1,
              borderStyle: "dashed",
              borderColor: C_RED_GRID,
            }}
          />
          {/* Vertical mid-line */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              borderLeftWidth: 1,
              borderStyle: "dashed",
              borderColor: C_RED_GRID,
            }}
          />

          {showAnimation ? (
            <StrokeAnimator hanzi={dict.hanzi} size={220} />
          ) : (
            <Text
              chinese
              style={{
                fontSize: 180,
                lineHeight: 220,
                color: C_RED,
                fontFamily: theme.fonts.chineseSerifBlack,
                textAlign: "center",
              }}
            >
              {dict.hanzi}
            </Text>
          )}
        </View>

        {/* Animation toggle pill — anchored bottom-right of the card */}
        <Pressable
          onPress={() => setShowAnimation((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={t.character.strokeAnimA11y}
          style={{
            position: "absolute",
            right: 0,
            bottom: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: C_INK,
          }}
        >
          <Play color="#FFFFFF" size={11} strokeWidth={2.4} fill="#FFFFFF" />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 11,
              lineHeight: 14,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {showAnimation ? t.character.animStop : t.character.animPlay}
          </Text>
        </Pressable>
      </View>

      {/* Stroke numbers row — purely visual reference for now, pinks per mock */}
      {strokeCount > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
        >
          {Array.from({ length: strokeCount }, (_, i) => (
            <View
              key={i}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: C_RED_100,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: C_RED_DEEP,
                  fontSize: 11,
                  lineHeight: 14,
                  fontFamily: theme.fonts.uiBold,
                }}
              >
                {i + 1}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* Mnemonic — preserved from old LearnStep */}
      {localized.mnemonic ? (
        <View
          style={{
            backgroundColor: C_RED_100,
            borderRadius: 10,
            padding: theme.spacing.md,
            gap: 4,
            marginTop: 4,
          }}
        >
          <Text
            style={{
              color: C_RED_DEEP,
              fontSize: 10,
              lineHeight: 13,
              letterSpacing: 1.2,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.character.mnemonicHeader.toUpperCase()}
          </Text>
          <Text
            style={{ color: C_INK, fontSize: 13, lineHeight: 18 }}
          >
            {localized.mnemonic}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MetaChip({
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
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 0.5,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

type StepStatus = "completed" | "active" | "pending";

function StepItem({
  step,
  status,
  onStart,
}: {
  step: StepDef;
  status: StepStatus;
  onStart: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const isActive = status === "active";
  const isCompleted = status === "completed";

  const cardBg = isActive ? C_INK : C_SURFACE;
  const labelColor = isActive ? "#FFFFFF" : C_INK;
  const hintColor = isActive ? "rgba(255,255,255,0.65)" : C_INK_3;

  return (
    <Pressable
      onPress={isActive ? onStart : undefined}
      disabled={!isActive}
      accessibilityRole={isActive ? "button" : undefined}
      accessibilityLabel={`${step.id}. ${step.label}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: cardBg,
        borderRadius: 12,
        borderWidth: isActive ? 0 : 1,
        borderColor: C_BORDER,
        padding: 12,
      }}
    >
      {/* Status tile */}
      {isCompleted ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: C_GREEN,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check color="#FFFFFF" size={20} strokeWidth={3} />
        </View>
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: isActive ? C_RED_100 : C_WARM,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            chinese
            style={{
              color: isActive ? C_RED_DEEP : C_INK_3,
              fontSize: 18,
              lineHeight: 22,
              fontFamily: useTheme().fonts.chineseSerifBlack,
            }}
          >
            {step.icon}
          </Text>
        </View>
      )}

      {/* Label + hint */}
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            color: labelColor,
            fontSize: 15,
            lineHeight: 19,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {step.id}. {step.label}
        </Text>
        <Text
          style={{
            color: hintColor,
            fontSize: 12,
            lineHeight: 16,
          }}
        >
          {t.character[step.hintKey]}
        </Text>
      </View>

      {/* Right-side CTA — only on the active card */}
      {isActive ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: C_RED,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 13,
              lineHeight: 16,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.character.startStep}
          </Text>
          <ArrowRight color="#FFFFFF" size={14} strokeWidth={2.6} />
        </View>
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline step shell — replaces the hub view while user runs a single step.
// Header gives an X to bail back to the hub mid-step (no progress lost: each
// step only writes on completion).
// ─────────────────────────────────────────────────────────────────────────────

function InlineStepShell({
  stepId,
  hskLevel,
  eyebrow,
  title,
  onClose,
  children,
}: {
  stepId: number;
  hskLevel: number | null;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel={t.character.toStepsA11y}
          style={{ paddingTop: 2 }}
        >
          <X color={C_INK_2} size={22} strokeWidth={2.2} />
        </Pressable>
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
            {hskLevel != null ? `HSK ${hskLevel} · ` : ""}
            {fmt(t.character.stepEyebrow, { n: stepId, eyebrow })}
          </Text>
          <Text
            style={{
              color: C_INK,
              fontSize: 18,
              lineHeight: 22,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {title}
          </Text>
        </View>
      </View>
      {/* Progress bar — 5 segments matching steps */}
      <View
        style={{
          flexDirection: "row",
          gap: 4,
          paddingHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                i < stepId ? C_GREEN : i === stepId ? "#4CAF50" : C_WARM,
            }}
          />
        ))}
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing["6xl"],
          gap: theme.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2 — Recognize (4-option multiple choice on meaning), per mock 20b.
// Layout: red "meaning" prompt → 2×2 grid of tian-zi-ge option cards →
// feedback card on the side that was answered → red "К произношению →" CTA.
// ──────────────────────────────────────────────────────────────────────────
function RecognizeStep({
  dict,
  distractors,
  nextLabel,
  onResult,
}: {
  dict: CharacterDictRow;
  distractors: CharacterDictRow[];
  nextLabel: string;
  onResult: (correct: boolean) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.native_language ?? "en");
  const localized = useLocalizedCharacter(
    dict.hanzi,
    dict.meanings,
    dict.mnemonic_en,
    lang,
  );
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo(() => {
    const pool = [dict, ...distractors.slice(0, 3)];
    return [...pool].sort(() => Math.random() - 0.5);
  }, [dict, distractors]);

  function choose(hanzi: string) {
    if (picked) return;
    const correct = hanzi === dict.hanzi;
    Haptics.impactAsync(
      correct
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(hanzi);
  }

  const revealed = picked !== null;
  const isCorrect = picked === dict.hanzi;
  const meaning = localized.meanings[0] ?? "";
  const correctPinyin = dict.pinyin[0] ?? "";
  const strokes = dict.stroke_count ?? null;
  const explanation = localized.mnemonic ?? null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {/* Prompt — red meaning under a small caption */}
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text
          style={{
            color: C_INK_3,
            fontSize: 11,
            letterSpacing: 1.4,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.character.whichMeans.toUpperCase()}
        </Text>
        <Text
          style={{
            color: C_RED,
            fontSize: 30,
            lineHeight: 36,
            fontFamily: theme.fonts.uiBold,
            textAlign: "center",
          }}
        >
          {meaning}
        </Text>
      </View>

      {/* 2×2 option grid */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        {options.map((o) => {
          const isPicked = picked === o.hanzi;
          const isThisCorrect = o.hanzi === dict.hanzi;
          const status: OptionStatus = !revealed
            ? "idle"
            : isThisCorrect
              ? "correct"
              : isPicked
                ? "wrong"
                : "muted";
          return (
            <RecognizeOptionCard
              key={o.hanzi}
              hanzi={o.hanzi}
              pinyin={o.pinyin[0] ?? ""}
              status={status}
              onPress={() => choose(o.hanzi)}
            />
          );
        })}
      </View>

      {/* Feedback + CTA */}
      {revealed ? (
        <>
          <RecognizeFeedbackCard
            isCorrect={isCorrect}
            correctHanzi={dict.hanzi}
            correctPinyin={correctPinyin}
            strokes={strokes}
            explanation={explanation}
            xp={isCorrect ? 3 : 2}
          />
          <Pressable
            onPress={() => onResult(isCorrect)}
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: C_RED,
              borderRadius: 14,
              paddingVertical: 16,
              opacity: pressed ? 0.92 : 1,
              ...theme.shadows.sm,
              shadowColor: C_RED,
              shadowOpacity: 0.3,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                lineHeight: 20,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {nextLabel}
            </Text>
            <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.6} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

type OptionStatus = "idle" | "correct" | "wrong" | "muted";

function RecognizeOptionCard({
  hanzi,
  pinyin,
  status,
  grid = true,
  onPress,
}: {
  hanzi: string;
  pinyin: string;
  status: OptionStatus;
  grid?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  // Visual states per mock 20b:
  //   idle    — white card, pale dashed tian-zi-ge, black hanzi, grey pinyin
  //   correct — green border, faint cream wash, green hanzi, ✓ badge
  //   wrong   — red border, faint cream wash, red hanzi, ✕ badge
  //   muted   — same as idle but faded a touch so the eye lands on the answer
  const isCorrect = status === "correct";
  const isWrong = status === "wrong";
  const isMuted = status === "muted";
  const borderColor = isCorrect
    ? "#4CAF50"
    : isWrong
      ? C_RED
      : C_BORDER;
  const bg = isCorrect || isWrong ? "#FBFAF6" : C_SURFACE;
  const hanziColor = isCorrect ? "#1F8A5B" : isWrong ? C_RED : C_INK;

  return (
    <Pressable
      onPress={onPress}
      disabled={status !== "idle"}
      accessibilityRole="button"
      accessibilityLabel={`${hanzi} ${pinyin}`}
      style={{
        flexBasis: "48%",
        aspectRatio: 1,
        borderRadius: 14,
        borderWidth: 2,
        borderColor,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        opacity: isMuted ? 0.55 : 1,
      }}
    >
      {/* Tian-zi-ge mini grid */}
      {grid ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            bottom: 28,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              borderTopWidth: 1,
              borderStyle: "dashed",
              borderColor: C_BORDER,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              borderLeftWidth: 1,
              borderStyle: "dashed",
              borderColor: C_BORDER,
            }}
          />
        </View>
      ) : null}

      {/* Status badge — green ✓ for correct, red ✕ for wrong */}
      {isCorrect ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#4CAF50",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check color="#FFFFFF" size={14} strokeWidth={3} />
        </View>
      ) : null}
      {isWrong ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: C_RED,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color="#FFFFFF" size={14} strokeWidth={3} />
        </View>
      ) : null}

      <Text
        chinese
        style={{
          color: hanziColor,
          fontSize: 64,
          lineHeight: 72,
          fontFamily: theme.fonts.chineseSerifBlack,
          marginTop: -10,
        }}
      >
        {hanzi}
      </Text>
      <Text
        style={{
          position: "absolute",
          bottom: 10,
          color: C_INK_3,
          fontSize: 12,
          lineHeight: 14,
          fontFamily: theme.fonts.pinyinMono,
        }}
      >
        {pinyin}
      </Text>
    </Pressable>
  );
}

function RecognizeFeedbackCard({
  isCorrect,
  correctHanzi,
  correctPinyin,
  strokes,
  explanation,
  xp,
}: {
  isCorrect: boolean;
  correctHanzi: string;
  correctPinyin: string;
  strokes: number | null;
  explanation: string | null;
  xp: number;
}) {
  const theme = useTheme();
  const t = useT();
  const bg = isCorrect ? "#E7F4E6" : "#FCE4E6";
  const iconBg = isCorrect ? "#4CAF50" : C_RED;
  const headerFg = isCorrect ? "#0F5E3F" : C_RED_DEEP;
  const subFg = isCorrect ? "#3F7250" : "#7A1C1C";
  const header = fmt(
    isCorrect ? t.character.feedbackCorrect : t.character.feedbackWrong,
    { hanzi: correctHanzi, pinyin: correctPinyin },
  );
  const subParts: string[] = [];
  if (strokes != null) {
    subParts.push(
      fmt(strokes === 1 ? t.character.strokesCountOne : t.character.strokesCountOther, {
        n: strokes,
      }),
    );
  }
  if (explanation) subParts.push(explanation);
  const subText = subParts.join(" · ");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        backgroundColor: bg,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {isCorrect ? (
          <Check color="#FFFFFF" size={16} strokeWidth={3} />
        ) : (
          <X color="#FFFFFF" size={16} strokeWidth={3} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            color: headerFg,
            fontSize: 13,
            lineHeight: 17,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {header}
        </Text>
        {subText ? (
          <Text style={{ color: subFg, fontSize: 12, lineHeight: 16 }}>
            {subText}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: isCorrect ? "#CDE7C3" : "#F4C2C7",
        }}
      >
        <Text
          style={{
            color: headerFg,
            fontSize: 11,
            lineHeight: 14,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          +{xp} XP
        </Text>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3 — Pronounce (mock 20c). Layout: hanzi + pinyin + listen pill at
// top → score-card with waveform after recording → mic + attempts counter
// → Skip / next-step CTA at bottom.
// ──────────────────────────────────────────────────────────────────────────
type PronouncePhase =
  | { kind: "idle" }
  | { kind: "recording"; stopFn: () => Promise<{ uri: string; mimeType: string } | null> }
  | { kind: "scoring" }
  | { kind: "revealed"; result: PronunciationResult };

// Daily attempt cap surfaced to the user — score-pronunciation enforces its
// own server-side limit; this is purely a visual counter so the user knows
// they're not unlimited.
const PRONOUNCE_DAILY_LIMIT = 20;

function PronounceStep({
  dict,
  nextLabel,
  onAdvance,
}: {
  dict: CharacterDictRow;
  nextLabel: string;
  onAdvance: (asCorrect: boolean) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const [phase, setPhase] = useState<PronouncePhase>({ kind: "idle" });
  const [attempts, setAttempts] = useState(0);

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase.kind !== "recording") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase.kind, pulse]);

  useEffect(() => {
    return () => {
      cancelActiveRecording().catch(() => {});
    };
  }, []);

  function speak() {
    Speech.stop().catch(() => {});
    Speech.speak(dict.hanzi, { language: "zh-CN", rate: 0.85 });
  }

  async function startRecord() {
    if (phase.kind !== "idle" && phase.kind !== "revealed") return;
    const granted = await ensureMicPermission();
    if (!granted) {
      toast.error(t.speaking.micPermission);
      return;
    }
    try {
      const handle = await startRecording();
      setPhase({ kind: "recording", stopFn: handle.stop });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err) {
      toast.error(t.speaking.recordingError);
      console.warn(err);
    }
  }

  async function stopAndScore() {
    if (phase.kind !== "recording") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const stopFn = phase.stopFn;
    setPhase({ kind: "scoring" });
    const file = await stopFn();
    if (!file) {
      setPhase({ kind: "idle" });
      return;
    }
    setAttempts((n) => n + 1);
    const res = await scorePronunciation(file.uri, file.mimeType, dict.hanzi);
    if (!res.ok) {
      setPhase({ kind: "idle" });
      const err = res.error;
      switch (err.kind) {
        case "audio_too_short":
          toast.info(t.speaking.audioTooShort);
          return;
        case "daily_limit":
          toast.info(fmt(t.speaking.dailyLimit, { used: err.used, limit: err.limit }));
          return;
        case "network":
          toast.error(t.speaking.networkError);
          return;
        default:
          toast.error(fmt(t.speaking.genericError, { kind: err.kind }));
          return;
      }
    }
    setPhase({ kind: "revealed", result: res.result });
  }

  const isRevealed = phase.kind === "revealed";
  const passed = isRevealed && phase.result.score >= 60;
  const isRecording = phase.kind === "recording";
  const isScoring = phase.kind === "scoring";
  const correctPinyin = dict.pinyin[0] ?? "";
  const tone = detectToneNum(correctPinyin);

  return (
    <View style={{ flex: 1, gap: theme.spacing.lg }}>
      {/* Top — hanzi + pinyin + listen-sample pill */}
      <View style={{ alignItems: "center", gap: 10 }}>
        <Text
          chinese
          style={{
            fontSize: 120,
            lineHeight: 132,
            color: C_INK,
            fontFamily: theme.fonts.chineseSerifBlack,
          }}
        >
          {dict.hanzi}
        </Text>
        <Text
          style={{
            color: C_RED,
            fontSize: 28,
            lineHeight: 34,
            fontFamily: theme.fonts.uiBold,
            letterSpacing: 0.5,
          }}
        >
          {correctPinyin}
        </Text>
        <Pressable
          onPress={speak}
          accessibilityLabel={t.vocab.review.tapToReplay}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: C_WARM,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Volume2 color={C_RED} size={14} strokeWidth={2.4} />
          <Text
            style={{
              color: C_INK,
              fontSize: 13,
              lineHeight: 16,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {t.character.listenSample}
          </Text>
        </Pressable>
      </View>

      {/* Feedback card — only after a successful score */}
      {isRevealed ? (
        <PronounceFeedbackCard
          result={phase.result}
          tone={tone}
          correctHanzi={dict.hanzi}
        />
      ) : null}

      {/* Mic + attempts counter */}
      <View style={{ alignItems: "center", gap: 8, marginTop: theme.spacing.md }}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Pressable
            onPress={isRecording ? stopAndScore : startRecord}
            disabled={isScoring}
            accessibilityLabel={
              isRecording ? t.speaking.tapToStop : t.speaking.tapAndSay
            }
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isRecording
                ? C_RED
                : isRevealed
                  ? C_WARM
                  : C_WARM,
              borderWidth: isRecording ? 0 : 1,
              borderColor: C_BORDER,
              alignItems: "center",
              justifyContent: "center",
              opacity: isScoring ? 0.5 : 1,
            }}
          >
            {isRecording ? (
              <Square color="#FFFFFF" size={24} strokeWidth={2} fill="#FFFFFF" />
            ) : (
              <Mic color={C_INK_2} size={28} strokeWidth={2.2} />
            )}
          </Pressable>
        </Animated.View>
        <Text
          style={{
            color: C_INK_3,
            fontSize: 12,
            lineHeight: 16,
          }}
        >
          {isRecording
            ? t.speaking.tapToStop
            : isScoring
              ? t.speaking.scoring
              : attempts > 0
                ? fmt(t.character.recordAgainAttempts, { n: attempts, limit: PRONOUNCE_DAILY_LIMIT })
                : t.speaking.tapAndSay}
        </Text>
      </View>

      {/* Bottom action row — skip (left) + next-step CTA (right). Always
          visible so the user can bail without recording. */}
      <View style={{ flex: 1 }} />
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          marginTop: theme.spacing.lg,
        }}
      >
        <Pressable
          onPress={() => onAdvance(false)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: C_SURFACE,
            borderWidth: 1,
            borderColor: C_BORDER,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: C_INK,
              fontSize: 15,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {t.common.skip}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onAdvance(isRevealed ? passed : false)}
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
          style={({ pressed }) => ({
            flex: 2,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: C_RED,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: pressed ? 0.92 : 1,
            ...theme.shadows.sm,
            shadowColor: C_RED,
            shadowOpacity: 0.3,
          })}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 16,
              lineHeight: 20,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {nextLabel}
          </Text>
          <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

function PronounceFeedbackCard({
  result,
  tone,
  correctHanzi,
}: {
  result: PronunciationResult;
  tone: 0 | 1 | 2 | 3 | 4;
  correctHanzi: string;
}) {
  const theme = useTheme();
  const t = useT();
  const score = result.score;
  // Verdict → palette + xp. Green family for excellent/good, amber for
  // try_again, red for unclear. XP scales with verdict per the existing
  // reward curve (+5 excellent / +4 good / +2 try_again / +1 unclear).
  const palette =
    result.verdict === "excellent"
      ? { tone: "good", bg: "#E7F4E6", chip: "#4CAF50", header: "#0F5E3F", sub: "#3F7250", xp: 5 }
      : result.verdict === "good"
        ? { tone: "good", bg: "#E7F4E6", chip: "#4CAF50", header: "#0F5E3F", sub: "#3F7250", xp: 4 }
        : result.verdict === "try_again"
          ? { tone: "warn", bg: "#FEF3D9", chip: C_AMBER_INK, header: "#5A3B00", sub: "#7A5500", xp: 2 }
          : { tone: "bad", bg: "#FCE4E6", chip: C_RED, header: C_RED_DEEP, sub: "#7A1C1C", xp: 1 };
  const verdictLabel =
    result.verdict === "excellent"
      ? "EXCELLENT"
      : result.verdict === "good"
        ? "GOOD"
        : result.verdict === "try_again"
          ? "TRY AGAIN"
          : "UNCLEAR";
  // Tone-specific copy — "Tone 4 — falling, exact" reads naturally. Modifier
  // depends on verdict (excellent → exact, good → good, etc.).
  const TONE_NAMES: Record<1 | 2 | 3 | 4, string> = {
    1: t.character.tone1Name,
    2: t.character.tone2Name,
    3: t.character.tone3Name,
    4: t.character.tone4Name,
  };
  const toneModifier =
    result.verdict === "excellent"
      ? t.character.toneMatchExact
      : result.verdict === "good"
        ? t.character.toneMatchGood
        : result.verdict === "try_again"
          ? t.character.toneMatchApprox
          : t.character.toneMatchUnclear;
  const toneLine =
    tone === 0
      ? `${verdictLabel.toLowerCase()} — ${toneModifier}`
      : fmt(t.character.toneLine, { tone, name: TONE_NAMES[tone], modifier: toneModifier });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        gap: 12,
        backgroundColor: palette.bg,
        borderRadius: 14,
        padding: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Faint watermark hanzi in the corner — same "poster" idiom */}
      <Text
        chinese
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -10,
          bottom: -32,
          fontSize: 130,
          lineHeight: 130,
          color: "rgba(31, 138, 91, 0.06)",
          fontWeight: "900",
        }}
      >
        声
      </Text>

      {/* Score box */}
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 10,
          backgroundColor: palette.chip,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 26,
            lineHeight: 30,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {score}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            style={{
              color: palette.header,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 1.2,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {verdictLabel}
          </Text>
          <Text
            style={{
              color: palette.header,
              fontSize: 11,
              lineHeight: 14,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            +{palette.xp} XP
          </Text>
        </View>
        <Text
          style={{
            color: palette.header,
            fontSize: 14,
            lineHeight: 18,
            fontFamily: theme.fonts.uiSemiBold,
          }}
        >
          {toneLine}
        </Text>
        {result.transcript ? (
          <Text
            style={{
              color: palette.sub,
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            {fmt(t.speaking.heardLabel, { transcript: result.transcript })}
          </Text>
        ) : null}
        <Waveform score={score} color={palette.chip} />
      </View>
    </View>
  );
}

/**
 * Procedural waveform — 22 vertical bars with deterministic heights derived
 * from a simple sine + noise mix, so the same score always renders the same
 * pattern (no flicker between re-renders). Bar colour follows the verdict
 * chip colour so the card reads as one block.
 */
function Waveform({ score, color }: { score: number; color: string }) {
  const BAR_COUNT = 22;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    // 0..1 deterministic noise — sinusoidal mix keyed on index + score so
    // bar heights look like "real" speech (clusters of taller/shorter bars).
    const n =
      0.45 +
      0.35 * Math.sin(i * 0.7 + score * 0.13) +
      0.2 * Math.sin(i * 1.9 + score * 0.05);
    return Math.max(0.18, Math.min(1, n));
  });
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 2,
        height: 30,
        marginTop: 4,
      }}
    >
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${Math.round(h * 100)}%`,
            backgroundColor: color,
            opacity: 0.85,
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

const TONE_BY_CHAR_PINYIN: Record<string, 1 | 2 | 3 | 4> = {
  ā: 1, ē: 1, ī: 1, ō: 1, ū: 1, ǖ: 1,
  á: 2, é: 2, í: 2, ó: 2, ú: 2, ǘ: 2,
  ǎ: 3, ě: 3, ǐ: 3, ǒ: 3, ǔ: 3, ǚ: 3,
  à: 4, è: 4, ì: 4, ò: 4, ù: 4, ǜ: 4,
};

function detectToneNum(pinyin: string): 0 | 1 | 2 | 3 | 4 {
  for (const ch of pinyin) {
    const t = TONE_BY_CHAR_PINYIN[ch];
    if (t !== undefined) return t;
  }
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Step 4 — Write (mock 20d). Paper canvas with a mi-zi-ge guide grid, live
// stats (strokes / mistakes), per-stroke chips, a hint button + the
// next-step CTA. The actual tracing is delegated to the (now chromeless)
// StrokeQuiz; this component owns all the surrounding chrome.
// ──────────────────────────────────────────────────────────────────────────
type WriteProgress = {
  strokesDrawn: number;
  totalStrokes: number;
  mistakes: number;
  done: boolean;
  ready: boolean;
};

function WriteStub({
  dict,
  nextLabel,
  onDone,
}: {
  dict: CharacterDictRow;
  nextLabel: string;
  onDone: (asCorrect: boolean) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { width: screenW } = useWindowDimensions();
  const quizRef = useRef<StrokeQuizHandle>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [progress, setProgress] = useState<WriteProgress>({
    strokesDrawn: 0,
    totalStrokes: dict.stroke_count ?? 0,
    mistakes: 0,
    done: false,
    ready: false,
  });

  // Canvas fits the paper card (screen − step padding 32 − card padding 24).
  const canvasSize = Math.min(300, Math.max(220, screenW - 56));
  const total = progress.totalStrokes || dict.stroke_count || 0;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {/* Stats row — stroke progress + mistakes + animation toggle */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: C_RED_100,
          }}
        >
          <Text
            style={{
              color: C_RED_DEEP,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 0.5,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {progress.strokesDrawn} /{" "}
            {fmt(total === 1 ? t.character.strokesCountOne : t.character.strokesCountOther, {
              n: total,
            }).toUpperCase()}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: C_WARM,
          }}
        >
          <Text
            style={{
              color: C_INK_2,
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: 0.5,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {fmt(
              progress.mistakes === 1
                ? t.character.mistakesCountOne
                : t.character.mistakesCountOther,
              { n: progress.mistakes },
            ).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setShowAnimation((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={t.character.strokeAnimA11y}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: showAnimation ? C_INK : C_SURFACE,
            borderWidth: showAnimation ? 0 : 1,
            borderColor: C_BORDER,
          }}
        >
          <Play
            color={showAnimation ? "#FFFFFF" : C_INK}
            size={11}
            strokeWidth={2.4}
            fill={showAnimation ? "#FFFFFF" : C_INK}
          />
          <Text
            style={{
              color: showAnimation ? "#FFFFFF" : C_INK,
              fontSize: 12,
              lineHeight: 15,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {t.character.animPlay}
          </Text>
        </Pressable>
      </View>

      {/* Paper canvas */}
      <View
        style={{
          backgroundColor: "#F4EEE2",
          borderRadius: 16,
          padding: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showAnimation ? (
          <View
            style={{
              width: canvasSize,
              height: canvasSize,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <StrokeAnimator hanzi={dict.hanzi} size={canvasSize} />
          </View>
        ) : (
          <StrokeQuiz
            ref={quizRef}
            hanzi={dict.hanzi}
            size={canvasSize}
            chromeless
            showGrid
            canvasBg="transparent"
            onProgress={setProgress}
            onComplete={() => undefined}
          />
        )}
      </View>

      {/* Per-stroke chips */}
      {total > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
        >
          {Array.from({ length: total }, (_, i) => {
            const status: StepStatus =
              i < progress.strokesDrawn
                ? "completed"
                : i === progress.strokesDrawn
                  ? "active"
                  : "pending";
            return <StrokeChip key={i} index={i + 1} status={status} />;
          })}
        </ScrollView>
      ) : null}

      {/* Hint + next-step CTA */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Pressable
          onPress={() => quizRef.current?.hint()}
          disabled={showAnimation}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: C_SURFACE,
            borderWidth: 1,
            borderColor: C_BORDER,
            opacity: showAnimation ? 0.5 : pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 14 }}>💡</Text>
          <Text
            style={{
              color: C_INK,
              fontSize: 15,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {t.writing.hint}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onDone(progress.done && progress.mistakes === 0)}
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
          style={({ pressed }) => ({
            flex: 2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: C_RED,
            opacity: pressed ? 0.92 : 1,
            ...theme.shadows.sm,
            shadowColor: C_RED,
            shadowOpacity: 0.3,
          })}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 16,
              lineHeight: 20,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {nextLabel}
          </Text>
          <ArrowRight color="#FFFFFF" size={18} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

function StrokeChip({ index, status }: { index: number; status: StepStatus }) {
  const t = useT();
  const theme = useTheme();
  const isCompleted = status === "completed";
  const isActive = status === "active";
  const bg = isCompleted ? "#E7F4E6" : isActive ? C_RED_100 : C_SURFACE;
  const fg = isCompleted ? "#1F8A5B" : isActive ? C_RED_DEEP : C_INK_3;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: isCompleted || isActive ? 0 : 1,
        borderColor: C_BORDER,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
        }}
      >
        {fmt(t.character.strokeN, { n: index })}
      </Text>
      {isCompleted ? <Check color="#1F8A5B" size={12} strokeWidth={3} /> : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 5 — Produce (mock 20e). Two stacked sub-tasks: (1) type the pinyin,
// validated tone-insensitively → green tick; (2) pick the hanzi from 4
// options. Finishes with a dark "🏆 Завершить и освоить" CTA that masters
// the character.
// ──────────────────────────────────────────────────────────────────────────
function ProduceStep({
  dict,
  distractors,
  onResult,
}: {
  dict: CharacterDictRow;
  distractors: CharacterDictRow[];
  onResult: (correct: boolean) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.native_language ?? "en");
  const localized = useLocalizedCharacter(
    dict.hanzi,
    dict.meanings,
    dict.mnemonic_en,
    lang,
  );
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const expectedPinyin = (dict.pinyin[0] ?? "").toLowerCase();
  const stripTones = (s: string) =>
    s
      .replace(/[āáǎà]/g, "a")
      .replace(/[ēéěè]/g, "e")
      .replace(/[īíǐì]/g, "i")
      .replace(/[ōóǒò]/g, "o")
      .replace(/[ūúǔù]/g, "u")
      .replace(/[ǖǘǚǜü]/g, "u");
  const normalized = stripTones(typed.toLowerCase().trim());
  const expectedNormalized = stripTones(expectedPinyin);
  const pinyinCorrect = normalized.length > 0 && normalized === expectedNormalized;

  const candidatePool = useMemo(() => {
    const sharingStart = distractors.filter(
      (d) => d.pinyin[0]?.[0] === dict.pinyin[0]?.[0],
    );
    const pool = [
      dict,
      ...(sharingStart.length >= 3 ? sharingStart : distractors).slice(0, 3),
    ];
    return [...pool].sort(() => Math.random() - 0.5);
    // Lock the pool to `dict` so it doesn't reshuffle once the pinyin
    // validates (a deps change on pinyinCorrect would reorder the cards).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dict, distractors]);

  function choose(hanzi: string) {
    if (picked) return;
    const correct = hanzi === dict.hanzi;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(hanzi);
  }

  const meaning = localized.meanings[0] ?? "";
  const canFinish = picked !== null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {/* Prompt */}
      <View style={{ alignItems: "center", gap: 6 }}>
        <Text
          style={{
            color: C_INK_3,
            fontSize: 11,
            letterSpacing: 1.4,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.character.howToSayLabel}
        </Text>
        <Text
          style={{
            color: C_INK,
            fontSize: 28,
            lineHeight: 34,
            fontFamily: theme.fonts.uiBold,
            textAlign: "center",
          }}
        >
          «{meaning}»
        </Text>
      </View>

      {/* Sub-task 1 — type pinyin */}
      <View
        style={{
          borderRadius: 14,
          borderWidth: 2,
          borderColor: pinyinCorrect ? "#4CAF50" : C_BORDER,
          backgroundColor: pinyinCorrect ? "#FBFAF6" : C_SURFACE,
          padding: 14,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              color: pinyinCorrect ? "#0F5E3F" : C_INK_3,
              fontSize: 11,
              letterSpacing: 1,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.character.pinyinSubtask}
          </Text>
          {pinyinCorrect ? (
            <Check color="#1F8A5B" size={13} strokeWidth={3} />
          ) : null}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            editable={!pinyinCorrect}
            placeholder={stripTones(expectedPinyin)}
            placeholderTextColor={C_INK_3}
            style={{
              flex: 1,
              fontSize: 26,
              padding: 0,
              fontFamily: theme.fonts.uiBold,
              color: pinyinCorrect ? "#1F8A5B" : C_INK,
            }}
          />
          <Text style={{ color: C_INK_3, fontSize: 13, fontFamily: theme.fonts.pinyinMono }}>
            {t.character.expectedLabel}
            <Text style={{ color: C_RED, fontFamily: theme.fonts.pinyinMono }}>
              {expectedPinyin}
            </Text>
          </Text>
        </View>
      </View>

      {/* Sub-task 2 — pick hanzi */}
      <View style={{ gap: 10, opacity: pinyinCorrect ? 1 : 0.45 }}>
        <Text
          style={{
            color: C_INK_3,
            fontSize: 11,
            letterSpacing: 1,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.character.hanziSubtask}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          {candidatePool.map((c) => {
            const isPicked = picked === c.hanzi;
            const isThisCorrect = c.hanzi === dict.hanzi;
            const status: OptionStatus = picked === null
              ? "idle"
              : isThisCorrect
                ? "correct"
                : isPicked
                  ? "wrong"
                  : "muted";
            return (
              <RecognizeOptionCard
                key={c.hanzi}
                hanzi={c.hanzi}
                pinyin={c.pinyin[0] ?? ""}
                status={status}
                grid={false}
                onPress={() => (pinyinCorrect ? choose(c.hanzi) : undefined)}
              />
            );
          })}
        </View>
      </View>

      {/* Finish CTA — dark, masters the character */}
      <Pressable
        onPress={() => onResult(picked === dict.hanzi)}
        disabled={!canFinish}
        accessibilityRole="button"
        accessibilityLabel={t.character.finishMaster}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 16,
          borderRadius: 14,
          backgroundColor: C_INK,
          opacity: !canFinish ? 0.4 : pressed ? 0.9 : 1,
          marginTop: 4,
        })}
      >
        <Text style={{ fontSize: 16 }}>🏆</Text>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 16,
            lineHeight: 20,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.character.finishMaster}
        </Text>
      </Pressable>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Compounds — words that contain this character
// ──────────────────────────────────────────────────────────────────────────
type CompoundItem = HskWord & { meaning: string };

function CompoundsBlock({ char }: { char: string }) {
  const theme = useTheme();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.native_language ?? "en");
  const [items, setItems] = useState<CompoundItem[] | null>(null);
  const [selected, setSelected] = useState<WordDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    (async () => {
      const words = await fetchWordsContaining(char, 12);
      if (cancelled) return;
      if (words.length === 0) {
        setItems([]);
        return;
      }
      let translations: Record<string, string[]> = {};
      try {
        translations = await fetchTranslations(words.map((w) => w.hanzi), lang);
      } catch {
        translations = {};
      }
      if (cancelled) return;
      setItems(
        words.map((w) => ({ ...w, meaning: translations[w.hanzi]?.[0] ?? "" })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [char, lang]);

  if (items === null) {
    return (
      <View
        style={{
          padding: theme.spacing.md,
          borderRadius: 12,
          backgroundColor: C_SURFACE,
          borderWidth: 1,
          borderColor: C_BORDER,
          alignItems: "center",
          minHeight: 80,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={C_RED} />
      </View>
    );
  }
  if (items.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: C_SURFACE,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C_BORDER,
        padding: theme.spacing.md,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: C_RED }} />
        <Text
          style={{
            color: C_INK,
            fontSize: 12,
            lineHeight: 14,
            letterSpacing: 1.2,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {fmt(t.character.wordsWith, { char })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm }}
      >
        {items.map((w) => (
          <Pressable
            key={w.hanzi}
            onPress={() =>
              setSelected({
                hanzi: w.hanzi,
                pinyin: w.pinyin,
                english: w.meaning,
                hskLevel: w.hsk_new ?? w.hsk_old ?? null,
              })
            }
            style={{
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              backgroundColor: C_PAPER,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C_BORDER,
              minWidth: 88,
              alignItems: "center",
              gap: 2,
            }}
          >
            <Text chinese style={{ fontSize: 22, lineHeight: 26, fontWeight: "700" }}>
              {w.hanzi}
            </Text>
            <Text variant="caption" color="accent" numberOfLines={1}>
              {w.pinyin}
            </Text>
            {w.meaning ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {w.meaning}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      <WordDetailSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        word={selected}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function formatDate(iso: string, t: Translations): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.round((d.getTime() - now) / 86_400_000);
  if (diff <= 0) return t.character.relativeNow;
  if (diff === 1) return t.character.relativeTomorrow;
  if (diff < 7) return fmt(t.character.relativeInDays, { n: diff });
  if (diff < 30) return fmt(t.character.relativeInWeeks, { n: Math.round(diff / 7) });
  return fmt(t.character.relativeInMonths, { n: Math.round(diff / 30) });
}
