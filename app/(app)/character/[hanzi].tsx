import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Volume2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { StrokeAnimator } from "@/components/StrokeAnimator";
import {
  advanceStep,
  fetchDict,
  fetchOneFromDict,
  fetchUserCharacter,
  STEP_LABELS,
  type CharacterDictRow,
  type UserCharacter,
} from "@/features/character/character";
import { recordActivity } from "@/features/activity/activity";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function CharacterDetail() {
  const theme = useTheme();
  const session = useUserStore((s) => s.session);
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
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Close">
          <X color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            Character · HSK {dict.hsk_level ?? "?"}
          </Text>
          <Text variant="bodyStrong">
            {mastered ? "Mastered" : `Step ${Math.min(stepIdx + 1, 5)} of 5 · ${STEP_LABELS[Math.min(stepIdx, 4)]}`}
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

        {progress ? (
          <Text variant="caption" color="tertiary" align="center">
            {progress.reps > 0 ? `${progress.reps} reps · next review ${formatDate(progress.due_at)}` : null}
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
          <Pressable onPress={speak} hitSlop={12} accessibilityLabel="Play audio">
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
          Meanings
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
            Mnemonic
          </Text>
          <Text variant="body">{dict.mnemonic_en}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: theme.spacing.md, justifyContent: "center" }}>
        <Stat label="Strokes" value={dict.stroke_count ?? "?"} />
        <Stat label="HSK" value={dict.hsk_level ?? "?"} />
        <Stat label="Rank" value={dict.frequency_rank ?? "?"} />
      </View>

      <Button label="Got it" size="lg" fullWidth onPress={onDone} />
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
          Which one means
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
          label="Continue"
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
          Whisper scoring — coming in Phase 6
        </Text>
        <Text variant="small" color="secondary" align="center">
          For now, listen and say it aloud. AI-scored pronunciation (tone accuracy, syllable feedback) lands with the speaking trainer.
        </Text>
      </View>

      <Button label="I said it — continue" size="lg" fullWidth onPress={onSkip} />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3 — Write (watch the stroke order animate)
// ──────────────────────────────────────────────────────────────────────────
function WriteStub({ dict, onSkip }: { dict: CharacterDictRow; onSkip: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl, alignItems: "center" }}>
      <StrokeAnimator hanzi={dict.hanzi} size={280} />

      <Text variant="body" color="secondary" align="center">
        Watch the stroke order. Real finger-tracing with scoring lands with the Skia writing trainer later.
      </Text>

      <Button label="Got it — continue" size="lg" fullWidth onPress={onSkip} />
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
          How do you say
        </Text>
        <Text variant="h1" align="center">
          {dict.meanings[0] ?? ""}
        </Text>
      </View>

      {!showCandidates ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="smallStrong" color="secondary">
            Type the pinyin (no tones needed)
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
            Expected: {expectedPinyin}
          </Text>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="smallStrong" color="secondary" align="center">
            Now pick the character
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
              label="Continue"
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
      <Text variant="h1">Mastered</Text>
      <Text chinese style={{ fontSize: 64, lineHeight: 72, color: theme.colors.accent, fontWeight: "700" }}>
        {dict.hanzi}
      </Text>
      <Text variant="body" color="secondary" align="center">
        This character will come back for review in two weeks to keep it fresh.
      </Text>
      <Button label="Back to roadmap" size="lg" fullWidth onPress={onClose} />
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.round((d.getTime() - now) / 86_400_000);
  if (diff <= 0) return "now";
  if (diff === 1) return "tomorrow";
  if (diff < 7) return `in ${diff} days`;
  if (diff < 30) return `in ${Math.round(diff / 7)}w`;
  return `in ${Math.round(diff / 30)}mo`;
}
