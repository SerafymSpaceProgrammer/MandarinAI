import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Volume2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { StrokeAnimator } from "@/components/StrokeAnimator";
import { StrokeQuiz } from "@/components/StrokeQuiz";
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
import { recordActivity } from "@/features/activity/activity";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

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

  // Which step the user is currently doing. Derives from progress.step_completed.
  // Step index 0..4 (Learn, Recognize, Pronounce, Write, Produce). 5 = mastered.
  const [stepIdx, setStepIdx] = useState(0);

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

  async function complete(step: number, options: { asCorrect?: boolean } = {}) {
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
  }

  if (loading || !dict) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  const mastered = stepIdx >= 5;

  return (
    <Screen>
      {/* Header */}
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
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.close}>
          <X color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {dict.hsk_level != null
              ? fmt(t.character.detailHeader, { n: dict.hsk_level })
              : t.character.detailHeaderUnknown}
          </Text>
          <Text variant="bodyStrong">
            {mastered
              ? t.character.masteredHeader
              : fmt(t.character.stepCounter, {
                  n: Math.min(stepIdx + 1, 5),
                  label: STEP_LABELS[Math.min(stepIdx, 4)] ?? "",
                })}
          </Text>
        </View>
      </View>

      {/* Step indicator */}
      <View
        style={{
          flexDirection: "row",
          gap: 4,
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.md,
        }}
      >
        {STEP_LABELS.map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < stepIdx ? theme.colors.success : i === stepIdx ? theme.colors.accent : theme.colors.surface,
            }}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}>
        {mastered ? (
          <MasteredView dict={dict} onClose={() => router.back()} />
        ) : stepIdx === 0 ? (
          <LearnStep dict={dict} onDone={() => complete(0)} />
        ) : stepIdx === 1 ? (
          <RecognizeStep
            dict={dict}
            distractors={distractors}
            onResult={(correct) => complete(1, { asCorrect: correct })}
          />
        ) : stepIdx === 2 ? (
          <PronounceStub dict={dict} onSkip={() => complete(2)} />
        ) : stepIdx === 3 ? (
          <WriteStub dict={dict} onSkip={() => complete(3)} />
        ) : (
          <ProduceStep
            dict={dict}
            distractors={distractors}
            onResult={(correct) => complete(4, { asCorrect: correct })}
          />
        )}

        {progress && progress.reps > 0 ? (
          <Text variant="caption" color="tertiary" align="center">
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

// ──────────────────────────────────────────────────────────────────────────
// Step 0 — Learn (introduction)
// ──────────────────────────────────────────────────────────────────────────
function LearnStep({ dict, onDone }: { dict: CharacterDictRow; onDone: () => void }) {
  const theme = useTheme();
  const t = useT();

  function speak() {
    Speech.stop().catch(() => {});
    Speech.speak(dict.hanzi, { language: "zh-CN", rate: 0.85 });
  }

  useEffect(() => {
    const id = setTimeout(() => speak(), 200);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dict.hanzi]);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ alignItems: "center", gap: theme.spacing.md }}>
        <Text
          chinese
          style={{ fontSize: 144, lineHeight: 160, fontWeight: "700", color: theme.colors.textPrimary }}
        >
          {dict.hanzi}
        </Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
          {dict.pinyin.map((p, i) => (
            <Text key={i} variant="h2" color="accent">
              {p}
            </Text>
          ))}
          <Pressable onPress={speak} hitSlop={12} accessibilityLabel={t.vocab.review.tapToReplay}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.accentMuted,
              }}
            >
              <Volume2 color={theme.colors.accent} size={20} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>
      </View>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
      >
        <Text variant="caption" color="tertiary">
          {t.character.meaningsHeader}
        </Text>
        {dict.meanings.map((m, i) => (
          <Text key={i} variant="body">
            · {m}
          </Text>
        ))}
      </View>

      {dict.mnemonic_en ? (
        <View
          style={{
            backgroundColor: theme.colors.accentMuted,
            borderRadius: theme.radii.md,
            padding: theme.spacing.lg,
            gap: theme.spacing.xs,
          }}
        >
          <Text variant="caption" color="accent">
            {t.character.mnemonicHeader}
          </Text>
          <Text variant="body">{dict.mnemonic_en}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: theme.spacing.md, justifyContent: "center" }}>
        <Stat label={t.character.strokesStat} value={dict.stroke_count ?? "?"} />
        <Stat label={t.character.hskStat} value={dict.hsk_level ?? "?"} />
        <Stat label={t.character.rankStat} value={dict.frequency_rank ?? "?"} />
      </View>

      <Button label={t.character.gotIt} size="lg" fullWidth onPress={onDone} />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 1 — Recognize (4-option multiple choice on meaning)
// ──────────────────────────────────────────────────────────────────────────
function RecognizeStep({
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
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo(() => {
    const pool = [dict, ...distractors.slice(0, 3)];
    return [...pool].sort(() => Math.random() - 0.5);
  }, [dict, distractors]);

  function choose(hanzi: string) {
    if (picked) return;
    const correct = hanzi === dict.hanzi;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(hanzi);
  }

  const revealed = picked !== null;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.sm, alignItems: "center" }}>
        <Text variant="caption" color="tertiary">
          {t.character.whichMeans}
        </Text>
        <Text variant="h1" align="center">
          {dict.meanings[0] ?? ""}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md, justifyContent: "center" }}>
        {options.map((o) => {
          const isPicked = picked === o.hanzi;
          const isCorrect = o.hanzi === dict.hanzi;
          const showCorrect = revealed && isCorrect;
          const showWrong = isPicked && !isCorrect;
          return (
            <Pressable
              key={o.hanzi}
              onPress={() => choose(o.hanzi)}
              disabled={revealed}
              style={{
                flexBasis: "45%",
                flexGrow: 1,
                paddingVertical: theme.spacing.lg,
                borderRadius: theme.radii.md,
                borderWidth: 2,
                borderColor: showCorrect
                  ? theme.colors.success
                  : showWrong
                    ? theme.colors.danger
                    : theme.colors.border,
                backgroundColor: theme.colors.surface,
                alignItems: "center",
                gap: 2,
              }}
            >
              <Text chinese style={{ fontSize: 40, lineHeight: 44, fontWeight: "700" }}>
                {o.hanzi}
              </Text>
              {revealed ? (
                <Text variant="small" color={isCorrect ? "success" : showWrong ? "danger" : "tertiary"}>
                  {o.pinyin[0] ?? ""}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {revealed ? (
        <Button
          label={t.common.continue}
          size="lg"
          fullWidth
          onPress={() => onResult(picked === dict.hanzi)}
        />
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2 — Pronounce (stub — real Whisper scoring arrives in Phase 6)
// ──────────────────────────────────────────────────────────────────────────
function PronounceStub({ dict, onSkip }: { dict: CharacterDictRow; onSkip: () => void }) {
  const theme = useTheme();
  const t = useT();

  function speak() {
    Speech.stop().catch(() => {});
    Speech.speak(dict.hanzi, { language: "zh-CN", rate: 0.9 });
  }

  return (
    <View style={{ gap: theme.spacing.xl, alignItems: "center" }}>
      <Text chinese style={{ fontSize: 96, lineHeight: 108, fontWeight: "700" }}>
        {dict.hanzi}
      </Text>
      <Text variant="h2" color="accent">
        {dict.pinyin.join(" / ")}
      </Text>

      <Pressable
        onPress={speak}
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: theme.colors.accentMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Volume2 color={theme.colors.accent} size={40} strokeWidth={2} />
      </Pressable>

      <View
        style={{
          padding: theme.spacing.lg,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          gap: theme.spacing.xs,
        }}
      >
        <Text variant="caption" color="warning">
          {t.character.pronounceSoon}
        </Text>
        <Text variant="small" color="secondary" align="center">
          {t.character.pronounceSoonHint}
        </Text>
      </View>

      <Button label={t.character.pronounceContinue} size="lg" fullWidth onPress={onSkip} />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3 — Write (trace strokes; falls back to animator if quiz unavailable)
// ──────────────────────────────────────────────────────────────────────────
function WriteStub({ dict, onSkip }: { dict: CharacterDictRow; onSkip: () => void }) {
  const theme = useTheme();
  const t = useT();
  const [showAnimation, setShowAnimation] = useState(false);
  const [completed, setCompleted] = useState(false);

  return (
    <View style={{ gap: theme.spacing.xl, alignItems: "center" }}>
      {showAnimation ? (
        <StrokeAnimator hanzi={dict.hanzi} size={280} />
      ) : (
        <StrokeQuiz
          hanzi={dict.hanzi}
          size={280}
          onComplete={() => setCompleted(true)}
        />
      )}

      <Text variant="body" color="secondary" align="center">
        {t.character.writeWatchHint}
      </Text>

      {!showAnimation ? (
        <Button
          label={t.writing.showAnimation}
          variant="ghost"
          fullWidth
          onPress={() => setShowAnimation(true)}
        />
      ) : null}

      <Button
        label={completed ? t.common.continue : t.character.writeContinue}
        size="lg"
        fullWidth
        onPress={onSkip}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 4 — Produce (English prompt → type pinyin → pick hanzi)
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
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const expectedPinyin = (dict.pinyin[0] ?? "").toLowerCase();
  const normalized = typed
    .toLowerCase()
    .trim()
    // strip tone marks so users don't have to type diacritics
    .replace(/[āáǎà]/g, "a")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜü]/g, "u");

  const expectedNormalized = expectedPinyin
    .replace(/[āáǎà]/g, "a")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜü]/g, "u");

  const showCandidates = normalized.length > 0 && normalized === expectedNormalized;

  const candidatePool = useMemo(() => {
    if (!showCandidates) return [];
    // Ensure correct answer is in the pool with 3 distractors.
    const sharingStart = distractors.filter((d) => d.pinyin[0]?.[0] === dict.pinyin[0]?.[0]);
    const pool = [dict, ...(sharingStart.length >= 3 ? sharingStart : distractors).slice(0, 3)];
    return [...pool].sort(() => Math.random() - 0.5);
  }, [showCandidates, dict, distractors]);

  function choose(hanzi: string) {
    if (picked) return;
    const correct = hanzi === dict.hanzi;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy,
    ).catch(() => {});
    setPicked(hanzi);
  }

  const revealed = picked !== null;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
        <Text variant="caption" color="tertiary">
          {t.character.produceHowSay}
        </Text>
        <Text variant="h1" align="center">
          {dict.meanings[0] ?? ""}
        </Text>
      </View>

      {!showCandidates ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="smallStrong" color="secondary">
            {t.character.typePinyin}
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={expectedPinyin.replace(/[āáǎà]/g, "a").replace(/[ēéěè]/g, "e").replace(/[īíǐì]/g, "i").replace(/[ōóǒò]/g, "o").replace(/[ūúǔù]/g, "u")}
            placeholderTextColor={theme.colors.textTertiary}
            style={{
              padding: theme.spacing.lg,
              fontSize: 24,
              textAlign: "center",
              borderRadius: theme.radii.md,
              borderWidth: 2,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
            }}
          />
          <Text variant="small" color="tertiary" align="center">
            {fmt(t.character.expectedPinyin, { pinyin: expectedPinyin })}
          </Text>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="smallStrong" color="secondary" align="center">
            {t.character.nowPickHanzi}
          </Text>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md, justifyContent: "center" }}
          >
            {candidatePool.map((c) => {
              const isPicked = picked === c.hanzi;
              const isCorrect = c.hanzi === dict.hanzi;
              const showCorrect = revealed && isCorrect;
              const showWrong = isPicked && !isCorrect;
              return (
                <Pressable
                  key={c.hanzi}
                  onPress={() => choose(c.hanzi)}
                  disabled={revealed}
                  style={{
                    flexBasis: "45%",
                    flexGrow: 1,
                    paddingVertical: theme.spacing.lg,
                    borderRadius: theme.radii.md,
                    borderWidth: 2,
                    borderColor: showCorrect
                      ? theme.colors.success
                      : showWrong
                        ? theme.colors.danger
                        : theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    alignItems: "center",
                  }}
                >
                  <Text chinese style={{ fontSize: 40, lineHeight: 44, fontWeight: "700" }}>
                    {c.hanzi}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {revealed ? (
            <Button
              label={t.common.continue}
              size="lg"
              fullWidth
              onPress={() => onResult(picked === dict.hanzi)}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mastered view
// ──────────────────────────────────────────────────────────────────────────
function MasteredView({ dict, onClose }: { dict: CharacterDictRow; onClose: () => void }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={{ alignItems: "center", gap: theme.spacing.lg, paddingVertical: theme.spacing["2xl"] }}>
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: theme.colors.success,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CheckCircle2 color={theme.colors.onAccent} size={56} strokeWidth={2.2} />
      </View>
      <Text variant="h1">{t.character.masteredCelebrate}</Text>
      <Text chinese style={{ fontSize: 64, lineHeight: 72, color: theme.colors.accent, fontWeight: "700" }}>
        {dict.hanzi}
      </Text>
      <Text variant="body" color="secondary" align="center">
        {t.character.masteredHint}
      </Text>
      <Button label={t.character.backToRoadmap} size="lg" fullWidth onPress={onClose} />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
    </View>
  );
}

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
