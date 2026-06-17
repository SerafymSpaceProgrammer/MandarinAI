import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import {
  Award,
  Check,
  ChevronRight,
  Droplet,
  Leaf,
  LayoutList,
  Mic,
  RotateCcw,
  Settings as SettingsIcon,
  Sprout,
  Target,
  Volume2,
  X,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

// Animated <Circle> — lets us drive strokeDashoffset from a single
// Animated.Value so the arc depletes continuously over the full timer
// duration instead of jumping in 1-second discrete steps.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { Modal, Screen, Text } from "@/components/ui";
import { HanziWithPinyin } from "@/features/grammar/components/HanziWithPinyin";
import {
  ALL_GRAMMAR_LEVELS,
  ALL_LEXICAL_LEVELS,
  availableLexicalLevels,
  constructionName,
  defaultLexicalLevelFor,
  getConstruction,
  getPhraseTranslation,
  type Construction,
  type GrammarLevel,
  type LexicalLevel,
  type PatternPhrase,
} from "@/features/grammar/patterns";
import { useUserStore } from "@/stores/userStore";
import {
  AUTO_ADVANCE_PRESETS,
  TIMER_PRESETS,
  useHydratedTrainerSettings,
  type RevealMode,
} from "@/features/grammar/store";
import { useHydratedPersonalDeck } from "@/features/grammar/personal";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { useTheme } from "@/theme";

type Phase = "prompt" | "revealed" | "done";

// Brand palette pulled from the design HTMLs — kept inline here so the screen
// is self-contained and the mocks are pixel-traceable without hopping files.
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
const C_GOLD = "#E0B86A";
const C_GREEN = "#1F8A5B";
const C_GREEN_LIGHT = "#DCEEDB";
const C_AMBER_TILE = "#FEF3D9";
const C_AMBER_INK = "#A85B00";

export default function GrammarTrainer() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    level?: string;
    grammar?: string;
    source?: string;
  }>();
  const isPersonal = params.source === "personal";
  const nativeLang = useUserStore((s) => s.profile?.native_language ?? "en");

  const personalDeck = useHydratedPersonalDeck();
  const settings = useHydratedTrainerSettings();
  const {
    grammarLevel: storedGrammar,
    level: storedLevel,
    timerSeconds,
    revealMode,
    autoAdvanceSeconds,
    zenMode,
    hydrated,
    setGrammarLevel,
    setLevel,
    setTimerSeconds,
    setRevealMode,
    setAutoAdvanceSeconds,
    setZenMode,
  } = settings;

  const queryGrammar = parseGrammar(params.grammar);
  const queryLevel = parseLevel(params.level);
  const [grammar, setActiveGrammar] = useState<GrammarLevel>(
    queryGrammar ?? storedGrammar,
  );
  const [level, setActiveLevel] = useState<LexicalLevel>(() => {
    const initial = queryLevel ?? storedLevel;
    const choices = availableLexicalLevels(queryGrammar ?? storedGrammar);
    return choices.includes(initial)
      ? initial
      : defaultLexicalLevelFor(queryGrammar ?? storedGrammar);
  });

  useEffect(() => {
    if (hydrated && !queryGrammar) setActiveGrammar(storedGrammar);
    if (hydrated && !queryLevel) {
      const choices = availableLexicalLevels(storedGrammar);
      setActiveLevel((cur) =>
        choices.includes(storedLevel) ? storedLevel : (choices[0] ?? cur),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const construction = useMemo<Construction | null>(() => {
    if (isPersonal) {
      if (!personalDeck.hydrated || !params.id) return null;
      return personalDeck.getConstruction(params.id) as Construction | null;
    }
    if (!hydrated) return null;
    const numericId = Number(params.id);
    if (!Number.isInteger(numericId)) return null;
    return getConstruction(grammar, level, numericId);
  }, [
    isPersonal,
    personalDeck.hydrated,
    personalDeck,
    hydrated,
    grammar,
    level,
    params.id,
  ]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const iterationRef = useRef<number>(1);

  const phrases = construction?.patterns ?? [];
  const total = phrases.length;
  const phrase = phrases[index];
  const accentChar = useMemo(
    () => (construction ? extractKeyChar(construction) : ""),
    [construction],
  );

  const advance = useCallback(() => {
    if (index + 1 >= total) {
      setPhase("done");
      return;
    }
    setIndex((i) => i + 1);
    setPhase("prompt");
  }, [index, total]);

  const reveal = useCallback(() => {
    setPhase((p) => (p === "prompt" ? "revealed" : p));
  }, []);

  const restart = useCallback(() => {
    iterationRef.current += 1;
    setIndex(0);
    setPhase("prompt");
    startTimeRef.current = Date.now();
  }, []);

  if (!hydrated || (isPersonal && !personalDeck.hydrated)) {
    return (
      <Screen padded>
        <View style={{ flex: 1 }} />
      </Screen>
    );
  }

  if (!construction) {
    return (
      <Screen padded>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.md,
          }}
        >
          <Text variant="h3">{t.sprint.notFound}</Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: C_RED,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{t.common.back}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
  const showProgress = phase !== "done";

  return (
    <Screen>
      {/* Top bar — X close, thin progress bar, gear / counter. The X is
          intentional (vs. a back arrow) to read as "exit drill" rather than
          "go back one step", matching mock 16a's grammar of a focused
          fullscreen session. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel={t.common.close}
          style={{ padding: 4 }}
        >
          <X color={C_INK} size={22} strokeWidth={2.2} />
        </Pressable>
        {showProgress ? (
          <View style={{ flex: 1 }}>
            <ProgressBar current={index + 1} total={total} />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {phase === "revealed" ? (
          <Text
            style={{
              color: C_INK_2,
              fontSize: 13,
              lineHeight: 16,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            {index + 1} / {total}
          </Text>
        ) : null}
        {phase !== "done" ? (
          <Pressable
            onPress={() => setSettingsOpen(true)}
            hitSlop={12}
            accessibilityLabel={t.sprint.settingsA11y}
            style={{ padding: 4 }}
          >
            <SettingsIcon color={C_INK_2} size={20} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {phase === "done" ? (
        <DoneScreen
          construction={construction}
          accentChar={accentChar}
          totalPhrases={total}
          elapsedSeconds={elapsedSeconds}
          iteration={iterationRef.current}
          onRestart={restart}
          onExit={() => router.back()}
        />
      ) : phrase && zenMode ? (
        <ZenView
          phase={phase}
          phrase={phrase}
          construction={construction}
          accentChar={accentChar}
          nativeLang={nativeLang}
          timerSeconds={timerSeconds}
          revealMode={revealMode}
          autoAdvanceSeconds={autoAdvanceSeconds}
          onReveal={reveal}
          onAdvance={advance}
          promptKey={`${construction.id}-${index}-${iterationRef.current}`}
        />
      ) : phrase ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing["8xl"],
            gap: theme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Chip row — grammar scope + lexical scope (or iteration in
              reveal phase, matching mock 16b's "2-Я ИТЕРАЦИЯ" badge). */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip
              tone="accent"
              label={
                isPersonal
                  ? t.sprint.chipPersonal
                  : fmt(t.sprint.chipConstruction, { char: accentChar || "PATTERN", n: grammar })
              }
            />
            <Chip
              tone="neutral"
              label={
                phase === "revealed" && iterationRef.current > 1
                  ? fmt(t.sprint.chipIteration, { n: iterationRef.current })
                  : isPersonal
                    ? t.sprint.chipMyDeck
                    : fmt(t.sprint.chipLex, { range: level === 1 ? "1" : `1—${level}` })
              }
            />
          </View>

          {/* Construction title + pattern syntax */}
          <View style={{ gap: 4 }}>
            <Text
              chinese
              style={{
                color: C_INK,
                fontSize: 24,
                lineHeight: 30,
                fontFamily: theme.fonts.uiBold,
              }}
              numberOfLines={2}
            >
              {prettyConstructionName(construction)}
            </Text>
            {construction.pattern ? (
              <Text
                style={{
                  color: C_RED,
                  fontSize: 14,
                  lineHeight: 18,
                  fontFamily: theme.fonts.pinyinMono,
                }}
                numberOfLines={1}
              >
                {construction.pattern}
              </Text>
            ) : null}
          </View>

          {/* Phrase counter eyebrow + lang indicator */}
          <PhraseEyebrow
            index={index}
            total={total}
            phrase={phrase}
            nativeLang={nativeLang}
          />

          {phase === "prompt" ? (
            <>
              <PromptText phrase={phrase} nativeLang={nativeLang} />

              <CountdownRingArc
                timerSeconds={timerSeconds}
                revealMode={revealMode}
                onAutoReveal={reveal}
                promptKey={`${construction.id}-${index}-${iterationRef.current}`}
              />

              <Text
                align="center"
                style={{
                  color: C_INK_2,
                  fontSize: 14,
                  lineHeight: 20,
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                {timerSeconds === 0
                  ? `${t.sprint.hintSayAloud}${t.sprint.hintTapButton}`
                  : revealMode === "auto"
                    ? t.sprint.hintAuto
                    : `${t.sprint.hintSayAloud}${t.sprint.hintWith}`}
                {timerSeconds !== 0 && revealMode !== "auto" && accentChar ? (
                  <Text
                    chinese
                    style={{ color: C_RED, fontFamily: theme.fonts.chineseSerif }}
                  >
                    {accentChar}
                  </Text>
                ) : null}
                {timerSeconds !== 0 && revealMode !== "auto" ? t.sprint.hintTapButton : ""}
                {revealMode !== "auto" ? (
                  <Text style={{ color: C_RED, fontWeight: "800" }}>
                    {t.sprint.show}
                  </Text>
                ) : null}
                {revealMode !== "auto" ? t.sprint.hintWhenReady : ""}
              </Text>
            </>
          ) : (
            <RevealCard
              phrase={phrase}
              construction={construction}
              accentChar={accentChar}
              nativeLang={nativeLang}
              autoAdvanceSeconds={autoAdvanceSeconds}
              onAdvance={advance}
              promptKey={`${construction.id}-${index}-${iterationRef.current}`}
            />
          )}

          <BottomActions
            phase={phase}
            onLeft={phase === "prompt" ? advance : restart}
            onRight={phase === "prompt" ? reveal : advance}
            leftLabel={phase === "prompt" ? t.sprint.skip : t.sprint.again}
            rightLabel={
              phase === "prompt"
                ? t.sprint.show
                : index + 1 >= total
                  ? t.sprint.finish
                  : t.sprint.nextPhrase
            }
            rightIcon={
              phase === "prompt" ? (
                <Check color="#FFFFFF" size={18} strokeWidth={2.6} />
              ) : (
                <ChevronRight color="#FFFFFF" size={18} strokeWidth={2.6} />
              )
            }
          />
        </ScrollView>
      ) : null}

      <Modal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <SettingsBody
          constructionTitle={prettyConstructionName(construction)}
          accentChar={accentChar}
          onClose={() => setSettingsOpen(false)}
          showLevels={!isPersonal}
          grammar={grammar}
          level={level}
          timerSeconds={timerSeconds}
          revealMode={revealMode}
          autoAdvanceSeconds={autoAdvanceSeconds}
          onGrammar={(g) => {
            setActiveGrammar(g);
            setGrammarLevel(g);
            const choices = availableLexicalLevels(g);
            if (!choices.includes(level)) {
              const fallback = defaultLexicalLevelFor(g);
              setActiveLevel(fallback);
              setLevel(fallback);
            }
            setIndex(0);
            setPhase("prompt");
            iterationRef.current = 1;
            startTimeRef.current = Date.now();
          }}
          onLevel={(l) => {
            setActiveLevel(l);
            setLevel(l);
            setIndex(0);
            setPhase("prompt");
            iterationRef.current = 1;
            startTimeRef.current = Date.now();
          }}
          onTimer={setTimerSeconds}
          onReveal={setRevealMode}
          onAutoAdvance={setAutoAdvanceSeconds}
        />
      </Modal>

      {/* Floating Zen / Detailed mode toggle — present in both modes during
          the drill (hidden on the done screen). */}
      {phase !== "done" ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: Math.max(insets.bottom, 8) + 8,
            alignItems: "center",
          }}
        >
          <ModeToggle zen={zenMode} onChange={setZenMode} />
        </View>
      ) : null}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode toggle — Zen ⇆ Detailed segmented control (mock dzen)
// ─────────────────────────────────────────────────────────────────────────────

function ModeToggle({
  zen,
  onChange,
}: {
  zen: boolean;
  onChange: (zen: boolean) => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: C_SURFACE,
        borderRadius: theme.radii.full,
        borderWidth: 1,
        borderColor: C_BORDER,
        padding: 4,
        ...theme.shadows.md,
        shadowOpacity: 0.12,
      }}
    >
      <ModeSegment
        active={zen}
        label={t.sprint.zen}
        icon={
          <Leaf
            color={zen ? C_RED : C_INK_3}
            size={15}
            strokeWidth={2.2}
            fill={zen ? C_RED : "transparent"}
          />
        }
        onPress={() => onChange(true)}
      />
      <ModeSegment
        active={!zen}
        label={t.sprint.detailed}
        icon={
          <LayoutList color={!zen ? C_INK : C_INK_3} size={15} strokeWidth={2.2} />
        }
        onPress={() => onChange(false)}
      />
    </View>
  );
}

function ModeSegment({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: theme.radii.full,
        backgroundColor: active ? C_WARM : "transparent",
      }}
    >
      {icon}
      <Text
        style={{
          color: active ? C_INK : C_INK_3,
          fontSize: 14,
          lineHeight: 17,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zen view — minimalist prompt → reveal flow (mocks 16a/16b dzen). No chips,
// no cards, no buttons: the whole surface is tappable (prompt → reveal →
// next), and a compact countdown ring auto-reveals in auto mode.
// ─────────────────────────────────────────────────────────────────────────────

function ZenView({
  phase,
  phrase,
  construction,
  accentChar,
  nativeLang,
  timerSeconds,
  revealMode,
  autoAdvanceSeconds,
  onReveal,
  onAdvance,
  promptKey,
}: {
  phase: Phase;
  phrase: PatternPhrase;
  construction: Construction;
  accentChar: string;
  nativeLang: string;
  timerSeconds: number;
  revealMode: RevealMode;
  autoAdvanceSeconds: number;
  onReveal: () => void;
  onAdvance: () => void;
  promptKey: string;
}) {
  const theme = useTheme();
  const t = useT();
  const { text: promptText } = getPhraseTranslation(phrase, nativeLang);

  // Auto-advance after reveal (mirrors the detailed RevealCard behaviour).
  useEffect(() => {
    if (phase !== "revealed" || autoAdvanceSeconds === 0) return;
    const id = setTimeout(onAdvance, autoAdvanceSeconds * 1000);
    return () => clearTimeout(id);
  }, [phase, autoAdvanceSeconds, onAdvance, promptKey]);

  const speak = useCallback(() => {
    Speech.stop();
    Speech.speak(phrase.zh, { language: "zh-CN", rate: 0.9 });
  }, [phrase.zh]);

  // Tapping anywhere advances the flow: prompt → reveal, reveal → next.
  const onTapSurface = () => {
    if (phase === "prompt") onReveal();
    else onAdvance();
  };

  const subtitle = [accentChar, construction.pattern].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onTapSurface}
      style={{
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing["8xl"],
      }}
    >
      {/* Subtle eyebrow — construction + pattern, very low contrast */}
      {subtitle ? (
        <Text
          align="center"
          style={{
            color: C_INK_3,
            fontSize: 13,
            lineHeight: 18,
            fontFamily: theme.fonts.uiSemiBold,
            letterSpacing: 0.5,
            paddingTop: theme.spacing.sm,
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}

      {phase === "prompt" ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing["2xl"],
          }}
        >
          <Text
            align="center"
            style={{
              color: C_INK,
              fontSize: 30,
              lineHeight: 38,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {promptText}
          </Text>

          <CountdownRingArc
            timerSeconds={timerSeconds}
            revealMode={revealMode}
            onAutoReveal={onReveal}
            promptKey={promptKey}
            size={120}
            compact
          />

          <Text
            align="center"
            style={{
              color: C_INK_3,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {revealMode === "auto"
              ? t.sprint.zenHintAuto
              : t.sprint.zenHintWith}
            {revealMode !== "auto" && accentChar ? (
              <Text chinese style={{ color: C_RED, fontFamily: theme.fonts.chineseSerif }}>
                {accentChar}
              </Text>
            ) : null}
          </Text>
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.xl,
          }}
        >
          <Text
            align="center"
            style={{ color: C_INK_3, fontSize: 15, lineHeight: 20 }}
          >
            {promptText}
          </Text>

          <HanziWithPinyin
            hanzi={phrase.zh}
            fallbackPinyin={phrase.py}
            hanziSize={40}
            accentChars={accentChar}
            pinyinBelow
          />

          <Pressable
            onPress={speak}
            hitSlop={12}
            accessibilityLabel={t.sprint.speakA11y}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: C_RED_100,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Volume2 color={C_RED} size={22} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — header chips, prompt block, reveal block, done screen
// ─────────────────────────────────────────────────────────────────────────────

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "accent" | "neutral";
}) {
  const theme = useTheme();
  const bg = tone === "accent" ? C_RED_100 : C_WARM;
  const fg = tone === "accent" ? C_RED_DEEP : C_INK_2;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: theme.radii.sm,
        backgroundColor: bg,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: fg,
          fontSize: 11,
          lineHeight: 14,
          letterSpacing: 0.6,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function PhraseEyebrow({
  index,
  total,
  phrase,
  nativeLang,
}: {
  index: number;
  total: number;
  phrase: PatternPhrase;
  nativeLang: string;
}) {
  const theme = useTheme();
  const t = useT();
  const { lang } = getPhraseTranslation(phrase, nativeLang);
  const fellBack = lang !== nativeLang;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: -4,
      }}
    >
      <Text
        style={{
          color: C_INK_3,
          fontSize: 11,
          lineHeight: 14,
          letterSpacing: 1.2,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {fmt(t.sprint.phraseCounter, { n: index + 1, total })}
      </Text>
      <View
        style={{
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: fellBack ? C_WARM : C_RED_100,
        }}
      >
        <Text
          style={{
            color: fellBack ? C_INK_3 : C_RED_DEEP,
            fontSize: 10,
            lineHeight: 13,
            letterSpacing: 0.5,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {lang.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function PromptText({
  phrase,
  nativeLang,
}: {
  phrase: PatternPhrase;
  nativeLang: string;
}) {
  const theme = useTheme();
  const { text } = getPhraseTranslation(phrase, nativeLang);
  return (
    <Text
      style={{
        color: C_INK,
        fontSize: 28,
        lineHeight: 36,
        fontFamily: theme.fonts.uiBold,
      }}
    >
      {text}
    </Text>
  );
}

/**
 * Circular SVG countdown. The arc depletes from the top (12-o-clock) clockwise
 * as seconds tick down; the remaining-seconds number sits dead-centre with a
 * "секунды" caption beneath. Renders a static eye-icon variant when the timer
 * is disabled, so the visual rhythm of "big ring → secondary text" still
 * holds even in no-timer mode.
 */
function CountdownRingArc({
  timerSeconds,
  revealMode,
  onAutoReveal,
  promptKey,
  size = 220,
  compact = false,
}: {
  timerSeconds: number;
  revealMode: RevealMode;
  onAutoReveal: () => void;
  promptKey: string;
  /** Outer diameter. Zen mode uses a smaller ring (~120). */
  size?: number;
  /** Hide the seconds caption + use a thinner stroke (zen minimalism). */
  compact?: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  // `progress` is a continuous 1 → 0 ramp over the full timer duration. The
  // arc reads it directly via interpolation, so the depletion is silky —
  // not the 1-step-per-second jump we had before. We tee off a JS listener
  // to keep the visible number/seconds caption in sync via ceil(), so the
  // digit ticks once per second but the ring keeps animating between ticks.
  const progress = useRef(new Animated.Value(1)).current;
  const [displayRemaining, setDisplayRemaining] = useState(timerSeconds);

  useEffect(() => {
    if (timerSeconds === 0) {
      progress.setValue(0);
      setDisplayRemaining(0);
      return;
    }
    progress.setValue(1);
    setDisplayRemaining(timerSeconds);

    const listenerId = progress.addListener(({ value }) => {
      setDisplayRemaining((cur) => {
        const next = Math.max(0, Math.ceil(value * timerSeconds));
        return next === cur ? cur : next;
      });
    });

    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: timerSeconds * 1000,
      easing: Easing.linear,
      // strokeDashoffset is a non-layout, non-transform prop, so the native
      // driver isn't available here. JS-driven is fine — the listener
      // updates state at sub-frame granularity but state setter is gated.
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && revealMode === "auto") onAutoReveal();
    });

    return () => {
      progress.removeListener(listenerId);
      anim.stop();
    };
  }, [promptKey, timerSeconds, revealMode, onAutoReveal, progress]);

  const stroke = compact ? 6 : 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  const numberSize = compact ? Math.round(size * 0.34) : 56;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: compact ? 0 : theme.spacing.lg,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={C_WARM}
            strokeWidth={stroke}
            fill="none"
          />
          {timerSeconds > 0 ? (
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={C_RED}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View
          style={{
            width: size - stroke * 4,
            height: size - stroke * 4,
            borderRadius: (size - stroke * 4) / 2,
            backgroundColor: C_PAPER,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {timerSeconds === 0 ? (
            <Text
              style={{
                color: C_INK,
                fontSize: numberSize,
                lineHeight: Math.round(numberSize * 1.14),
                fontFamily: theme.fonts.uiBold,
              }}
            >
              ∞
            </Text>
          ) : (
            <>
              <Text
                style={{
                  color: C_INK,
                  fontSize: numberSize,
                  lineHeight: Math.round(numberSize * 1.14),
                  fontFamily: theme.fonts.uiBold,
                }}
              >
                {displayRemaining}
              </Text>
              {!compact ? (
                <Text
                  style={{
                    color: C_INK_3,
                    fontSize: 12,
                    lineHeight: 16,
                    letterSpacing: 1.2,
                    fontFamily: theme.fonts.uiSemiBold,
                    marginTop: 2,
                  }}
                >
                  {displayRemaining === 1 ? t.sprint.secondsOne : t.sprint.secondsOther}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function RevealCard({
  phrase,
  construction,
  accentChar,
  nativeLang,
  autoAdvanceSeconds,
  onAdvance,
  promptKey,
}: {
  phrase: PatternPhrase;
  construction: Construction;
  accentChar: string;
  nativeLang: string;
  autoAdvanceSeconds: number;
  onAdvance: () => void;
  promptKey: string;
}) {
  const theme = useTheme();
  const t = useT();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(8)).current;
  const [rate, setRate] = useState(0.85);

  useEffect(() => {
    opacity.setValue(0);
    translate.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [promptKey, opacity, translate]);

  useEffect(() => {
    if (autoAdvanceSeconds === 0) return;
    const id = setTimeout(onAdvance, autoAdvanceSeconds * 1000);
    return () => clearTimeout(id);
  }, [autoAdvanceSeconds, onAdvance, promptKey]);

  const speak = useCallback(() => {
    Speech.stop();
    Speech.speak(phrase.zh, { language: "zh-CN", rate });
  }, [phrase.zh, rate]);

  const cycleRate = useCallback(() => {
    setRate((r) => (r <= 0.6 ? 1.0 : r === 1.0 ? 0.85 : 0.7));
  }, []);

  const { text: ruText } = getPhraseTranslation(phrase, nativeLang);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: translate }],
        opacity,
        gap: theme.spacing.md,
      }}
    >
      {/* Main reveal card — paper white, with a faint accent-char watermark in
          the corner echoing the construction's hero glyph. */}
      <View
        style={{
          backgroundColor: C_SURFACE,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: C_BORDER,
          padding: theme.spacing.lg,
          overflow: "hidden",
        }}
      >
        {accentChar ? (
          <Text
            chinese
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -20,
              bottom: -40,
              fontSize: 200,
              lineHeight: 200,
              fontWeight: "900",
              color: "rgba(230, 57, 70, 0.06)",
              fontFamily: theme.fonts.chineseSerifBlack,
            }}
          >
            {accentChar}
          </Text>
        ) : null}

        <Text
          style={{
            color: C_INK_3,
            fontSize: 11,
            lineHeight: 14,
            letterSpacing: 1.2,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {fmt(t.sprint.translateToChinese, { lang: nativeLang.toUpperCase() })}
        </Text>
        <Text
          style={{
            color: C_INK,
            fontSize: 22,
            lineHeight: 28,
            fontFamily: theme.fonts.uiBold,
            marginTop: 6,
          }}
        >
          {ruText}
        </Text>

        <DividerWithLabel label="REVEAL" />

        <View style={{ alignItems: "center" }}>
          <HanziWithPinyin
            hanzi={phrase.zh}
            fallbackPinyin={phrase.py}
            hanziSize={36}
            accentChars={accentChar}
            pinyinBelow
          />
        </View>

        {/* Per-construction explanation — localized description from the
            dataset (falls back to the curated russian gloss). Wraps in a warm
            tile with a red left bar so it reads as "subtitle / commentary"
            rather than another reveal line. */}
        {construction.ru_name ? (
          <View
            style={{
              flexDirection: "row",
              backgroundColor: C_WARM,
              borderRadius: theme.radii.sm,
              padding: theme.spacing.md,
              marginTop: theme.spacing.md,
              gap: 10,
            }}
          >
            <View
              style={{
                width: 3,
                backgroundColor: C_RED,
                borderRadius: 2,
                alignSelf: "stretch",
              }}
            />
            <Text
              style={{
                flex: 1,
                color: C_INK_2,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {constructionName(construction, nativeLang)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Speech control — pressable speaker on the left (plays TTS at the
          current rate), tappable rate label that cycles 0.7 → 0.85 → 1.0,
          and a mic affordance on the right reserved for the upcoming
          "произнеси сам" recording loop (no-op for now). */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: C_SURFACE,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: C_BORDER,
          paddingVertical: 10,
          paddingHorizontal: 12,
          gap: 10,
        }}
      >
        <Pressable
          onPress={speak}
          hitSlop={8}
          accessibilityLabel={t.sprint.speakA11y}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          }}
        >
          <Volume2 color={C_INK} size={18} strokeWidth={2.2} />
          <Text
            style={{
              color: C_INK,
              fontSize: 14,
              fontFamily: theme.fonts.uiSemiBold,
            }}
          >
            Озвучить
          </Text>
          <Pressable onPress={cycleRate} hitSlop={6}>
            <Text
              style={{
                color: C_INK_3,
                fontSize: 13,
                fontFamily: theme.fonts.pinyinMono,
              }}
            >
              · {rate.toFixed(2)}×
            </Text>
          </Pressable>
        </Pressable>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: C_RED_100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Mic color={C_RED} size={18} strokeWidth={2.2} />
        </View>
      </View>

      {/* Tempo tip — encourages the user to come back faster next iteration.
          Static informational strip, paper-amber to feel like a sticky note. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: C_AMBER_TILE,
          borderRadius: theme.radii.sm,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <Zap color={C_AMBER_INK} size={14} strokeWidth={2.4} fill={C_AMBER_INK} />
        <Text
          style={{
            color: C_AMBER_INK,
            fontSize: 12,
            lineHeight: 16,
            fontFamily: theme.fonts.uiSemiBold,
            flex: 1,
          }}
        >
          Темп ускоряется:  4s  →  2s  →  1.5s
        </Text>
      </View>
    </Animated.View>
  );
}

function DividerWithLabel({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginVertical: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: C_BORDER }} />
      <Text
        style={{
          color: C_INK_3,
          fontSize: 11,
          letterSpacing: 1.6,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: C_BORDER }} />
    </View>
  );
}

function BottomActions({
  phase,
  leftLabel,
  rightLabel,
  rightIcon,
  onLeft,
  onRight,
}: {
  phase: Phase;
  leftLabel: string;
  rightLabel: string;
  rightIcon: React.ReactNode;
  onLeft: () => void;
  onRight: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        marginTop: theme.spacing.md,
      }}
    >
      <Pressable
        onPress={onLeft}
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: 14,
          borderRadius: theme.radii.md,
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
          {leftLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={onRight}
        style={({ pressed }) => ({
          flex: 2,
          paddingVertical: 14,
          borderRadius: theme.radii.md,
          backgroundColor: C_RED,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.92 : 1,
          ...theme.shadows.sm,
          shadowColor: C_RED,
          shadowOpacity: 0.25,
        })}
      >
        {phase === "prompt" ? rightIcon : null}
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {rightLabel}
        </Text>
        {phase !== "prompt" ? rightIcon : null}
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Done screen — mock 16c
// ─────────────────────────────────────────────────────────────────────────────

function DoneScreen({
  construction,
  accentChar,
  totalPhrases,
  elapsedSeconds,
  iteration,
  onRestart,
  onExit,
}: {
  construction: Construction;
  accentChar: string;
  totalPhrases: number;
  elapsedSeconds: number;
  iteration: number;
  onRestart: () => void;
  onExit: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const perPhrase =
    totalPhrases > 0
      ? Math.round((elapsedSeconds / totalPhrases) * 10) / 10
      : 0;
  const targetPerPhrase = 1.5;
  // Speed history is session-local for now — we just append the current run
  // to a mutable ref-like array via state. With more sessions implemented
  // we'll persist this per-construction in AsyncStorage.
  const runs: number[] = useMemo(() => [perPhrase], [perPhrase]);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing["6xl"],
        gap: theme.spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — big red rounded square with the construction's key glyph,
          a lightning bolt badge top-left (sprint), and a green check
          bottom-right (completed). */}
      <View style={{ alignItems: "center", marginTop: theme.spacing.lg }}>
        <View style={{ width: 104, height: 104 }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 24,
              backgroundColor: C_RED,
              alignItems: "center",
              justifyContent: "center",
              ...theme.shadows.md,
              shadowColor: C_RED,
              shadowOpacity: 0.32,
            }}
          >
            <Text
              chinese
              style={{
                color: "#FFFFFF",
                fontSize: 56,
                lineHeight: 64,
                fontFamily: theme.fonts.chineseSerifBlack,
              }}
            >
              {accentChar || "✓"}
            </Text>
          </View>
          <View
            style={{
              position: "absolute",
              top: -6,
              left: -6,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: C_AMBER_INK,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: C_PAPER,
            }}
          >
            <Zap color="#FFFFFF" size={13} strokeWidth={2.6} fill="#FFFFFF" />
          </View>
          <View
            style={{
              position: "absolute",
              bottom: -4,
              right: -4,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: C_GREEN,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: C_PAPER,
            }}
          >
            <Check color="#FFFFFF" size={16} strokeWidth={3} />
          </View>
        </View>
      </View>

      <View style={{ gap: 8, alignItems: "center" }}>
        <Text
          align="center"
          style={{
            color: C_INK,
            fontSize: 32,
            lineHeight: 36,
            fontFamily: theme.fonts.uiBold,
          }}
        >
          {t.sprint.doneTitle}
        </Text>
        <Text
          align="center"
          style={{
            color: C_INK_2,
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {t.sprint.doneBodyPrefix}
          {accentChar ? (
            <Text
              chinese
              style={{
                color: C_RED,
                fontFamily: theme.fonts.chineseSerif,
                fontWeight: "800",
              }}
            >
              {accentChar}
            </Text>
          ) : (
            <Text style={{ color: C_RED, fontFamily: theme.fonts.uiBold }}>
              {construction.name}
            </Text>
          )}
          {fmt(
            totalPhrases === 1 ? t.sprint.doneBodySuffixOne : t.sprint.doneBodySuffixOther,
            { n: totalPhrases },
          )}
        </Text>
      </View>

      {/* Sprint tally pill — dark with gold text, echoing the postcard
          aesthetic of the rest of the app. The "iteration" is the current
          repetition count of this construction within the session. */}
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: theme.radii.full,
            backgroundColor: C_INK,
          }}
        >
          <Zap color={C_GOLD} size={14} strokeWidth={2.4} fill={C_GOLD} />
          <Text
            style={{
              color: C_GOLD,
              fontSize: 12,
              letterSpacing: 1.2,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {fmt(t.sprint.runTally, { n: iteration, xp: iteration * 12 })}
          </Text>
        </View>
      </View>

      {/* Stats grid 2×2 */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            icon={<Droplet color={C_RED} size={14} strokeWidth={2.4} fill={C_RED} />}
            value={formatSeconds(elapsedSeconds, t)}
            label={t.sprint.statTotalTime}
            sub={fmt(
              totalPhrases === 1 ? t.sprint.statTotalTimeSubOne : t.sprint.statTotalTimeSubOther,
              { n: totalPhrases },
            )}
          />
          <StatCard
            icon={<Zap color={C_AMBER_INK} size={14} strokeWidth={2.4} fill={C_AMBER_INK} />}
            value={fmt(t.sprint.secondsShort, { n: perPhrase })}
            label={t.sprint.statPerPhrase}
            sub={fmt(t.sprint.statPerPhraseSub, { n: targetPerPhrase })}
            delta={
              perPhrase <= targetPerPhrase
                ? { text: "✓", tone: "good" }
                : undefined
            }
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            icon={<Check color={C_GREEN} size={14} strokeWidth={3} />}
            value={String(totalPhrases)}
            label={t.sprint.statPhrasesDone}
            sub={fmt(t.sprint.statPhrasesDoneSub, { n: totalPhrases })}
            delta={{ text: "100%", tone: "good" }}
          />
          <StatCard
            icon={<Award color={C_GOLD} size={14} strokeWidth={2.4} />}
            value={String(iteration)}
            label={t.sprint.statRun}
            sub={iteration === 1 ? t.sprint.statRunFirst : t.sprint.statRunStreak}
            delta={iteration > 1 ? { text: "PB", tone: "gold" } : undefined}
          />
        </View>
      </View>

      {/* Speed-by-run chart. The current run is highlighted; placeholders
          for missing earlier runs fill the slot so the visual rhythm of
          "5 bars descending" survives even on first completion. */}
      <SpeedChart runs={runs} targetPerPhrase={targetPerPhrase} />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: theme.radii.md,
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
            {t.sprint.toList}
          </Text>
        </Pressable>
        <Pressable
          onPress={onRestart}
          style={({ pressed }) => ({
            flex: 2,
            paddingVertical: 14,
            borderRadius: theme.radii.md,
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
          <RotateCcw color="#FFFFFF" size={16} strokeWidth={2.4} />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.sprint.oneMoreLoop}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatCard({
  icon,
  value,
  label,
  sub,
  delta,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
  delta?: { text: string; tone: "good" | "bad" | "gold" };
}) {
  const theme = useTheme();
  const deltaBg =
    delta?.tone === "good"
      ? C_GREEN_LIGHT
      : delta?.tone === "gold"
        ? "#FFF1D6"
        : C_RED_100;
  const deltaFg =
    delta?.tone === "good"
      ? C_GREEN
      : delta?.tone === "gold"
        ? C_AMBER_INK
        : C_RED_DEEP;
  return (
    <View
      style={{
        flex: 1,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        backgroundColor: C_SURFACE,
        borderWidth: 1,
        borderColor: C_BORDER,
        gap: 6,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {icon}
        {delta ? (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 5,
              backgroundColor: deltaBg,
            }}
          >
            <Text
              style={{
                color: deltaFg,
                fontSize: 10,
                lineHeight: 14,
                fontFamily: theme.fonts.uiBold,
              }}
            >
              {delta.text}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          color: C_INK,
          fontSize: 26,
          lineHeight: 30,
          fontFamily: theme.fonts.uiBold,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: C_INK,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: C_INK_3,
          fontSize: 11,
          lineHeight: 14,
        }}
      >
        {sub}
      </Text>
    </View>
  );
}

function SpeedChart({
  runs,
  targetPerPhrase,
}: {
  runs: number[];
  targetPerPhrase: number;
}) {
  const theme = useTheme();
  const t = useT();
  // Pad the chart to 5 slots so the visual is always full width. Empty
  // slots render as faded placeholder bars.
  const SLOTS = 5;
  const padded: (number | null)[] = [
    ...Array(Math.max(0, SLOTS - runs.length)).fill(null),
    ...runs.slice(-SLOTS),
  ];
  const maxVal = Math.max(8, ...padded.filter((v): v is number => v !== null));
  return (
    <View
      style={{
        backgroundColor: C_INK,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <Text
        style={{
          color: C_GOLD,
          fontSize: 11,
          letterSpacing: 1.4,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {fmt(t.sprint.chartTitle, { n: SLOTS })}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: 120,
          gap: 10,
        }}
      >
        {padded.map((v, i) => {
          const isLast = i === padded.length - 1;
          const heightPct =
            v === null ? 0.12 : Math.max(0.18, Math.min(1, v / maxVal));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: v === null ? "rgba(255,255,255,0.3)" : "#FFFFFF",
                  fontSize: 11,
                  fontFamily: theme.fonts.pinyinMono,
                }}
              >
                {v === null ? "—" : fmt(t.sprint.secondsShort, { n: v })}
              </Text>
              <View
                style={{
                  width: "100%",
                  height: `${heightPct * 100}%`,
                  borderRadius: theme.radii.sm,
                  backgroundColor:
                    v === null
                      ? "rgba(255,255,255,0.08)"
                      : isLast
                        ? C_RED
                        : "rgba(255,255,255,0.2)",
                }}
              />
            </View>
          );
        })}
      </View>
      <Text
        style={{
          color: "rgba(255,255,255,0.55)",
          fontSize: 11,
          lineHeight: 16,
        }}
      >
        {fmt(t.sprint.chartFooter, { n: targetPerPhrase })}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings modal body — preserved from prior implementation
// ─────────────────────────────────────────────────────────────────────────────

// Preset tuples — three "shapes" of session captured in mock 18. Each maps to
// a (timer, revealMode, autoAdvance) triple; matching the user's current
// settings against these triples lights the active preset card so the user
// can both pick a preset AND see what the manual rows below correspond to.
type PresetId = "warmup" | "sprint" | "deep" | "custom";

const PRESETS: Record<
  Exclude<PresetId, "custom">,
  { timer: number; reveal: RevealMode; advance: number }
> = {
  warmup: { timer: 0, reveal: "manual", advance: 0 },
  sprint: { timer: 3, reveal: "auto", advance: 2 },
  deep: { timer: 8, reveal: "manual", advance: 0 },
};

function detectPreset(
  timer: number,
  reveal: RevealMode,
  advance: number,
): PresetId {
  for (const id of ["warmup", "sprint", "deep"] as const) {
    const p = PRESETS[id];
    if (p.timer === timer && p.reveal === reveal && p.advance === advance) {
      return id;
    }
  }
  return "custom";
}

function SettingsBody({
  constructionTitle,
  accentChar,
  onClose,
  showLevels,
  grammar,
  level,
  timerSeconds,
  revealMode,
  autoAdvanceSeconds,
  onGrammar,
  onLevel,
  onTimer,
  onReveal,
  onAutoAdvance,
}: {
  constructionTitle: string;
  accentChar: string;
  onClose: () => void;
  showLevels: boolean;
  grammar: GrammarLevel;
  level: LexicalLevel;
  timerSeconds: number;
  revealMode: RevealMode;
  autoAdvanceSeconds: number;
  onGrammar: (g: GrammarLevel) => void;
  onLevel: (l: LexicalLevel) => void;
  onTimer: (n: number) => void;
  onReveal: (r: RevealMode) => void;
  onAutoAdvance: (n: number) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const lexicalChoices = availableLexicalLevels(grammar);
  const activePreset = detectPreset(timerSeconds, revealMode, autoAdvanceSeconds);

  function applyPreset(id: Exclude<PresetId, "custom">) {
    const p = PRESETS[id];
    onTimer(p.timer);
    onReveal(p.reveal);
    onAutoAdvance(p.advance);
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: theme.spacing.md,
        gap: theme.spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header — red eyebrow + construction title with accent hanzi +
          close X. Replaces the Modal's default title bar so the sheet feels
          purpose-built for this construction. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: C_RED,
              fontSize: 12,
              lineHeight: 14,
              letterSpacing: 1.4,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {t.sprint.settingsTitle}
          </Text>
          <Text
            chinese
            numberOfLines={2}
            style={{
              color: C_INK,
              fontSize: 22,
              lineHeight: 28,
              fontFamily: theme.fonts.uiBold,
            }}
          >
            {accentChar ? (
              <Text
                chinese
                style={{ color: C_RED, fontFamily: theme.fonts.chineseSerif }}
              >
                {accentChar}
              </Text>
            ) : null}
            {accentChar ? " — " : ""}
            {constructionTitle}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel={t.common.close}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: C_WARM,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color={C_INK_2} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* РЕЖИМ — three preset cards in a row */}
      <SettingsSection
        label={t.sprint.sectionMode}
        hint={t.sprint.sectionModeHint}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PresetCard
            title={t.sprint.presetWarmup}
            subtitle={t.sprint.presetWarmupSub}
            icon={<Sprout color={C_GREEN} size={18} strokeWidth={2.2} />}
            tileBg={C_GREEN_LIGHT}
            active={activePreset === "warmup"}
            onPress={() => applyPreset("warmup")}
          />
          <PresetCard
            title={t.sprint.presetSprint}
            subtitle={t.sprint.presetSprintSub}
            icon={
              <Zap
                color="#FFFFFF"
                size={18}
                strokeWidth={2.2}
                fill="#FFFFFF"
              />
            }
            tileBg={C_RED}
            active={activePreset === "sprint"}
            onPress={() => applyPreset("sprint")}
          />
          <PresetCard
            title={t.sprint.presetDeep}
            subtitle={t.sprint.presetDeepSub}
            icon={<Target color="#6A4C9C" size={18} strokeWidth={2.2} />}
            tileBg="#EBE2FB"
            active={activePreset === "deep"}
            onPress={() => applyPreset("deep")}
          />
        </View>
      </SettingsSection>

      {showLevels ? (
        <SettingsSection
          label={t.sprint.sectionGrammar}
          hint={t.sprint.sectionGrammarHint}
        >
          <PillRow>
            {ALL_GRAMMAR_LEVELS.map((g) => (
              <Pill
                key={g}
                label={`HSK ${g}${g === 3 ? " · NEW" : ""}`}
                active={g === grammar}
                onPress={() => onGrammar(g)}
              />
            ))}
          </PillRow>
        </SettingsSection>
      ) : null}

      {showLevels ? (
        <SettingsSection
          label={t.sprint.sectionLexis}
          hint={t.sprint.sectionLexisHint}
        >
          <PillRow>
            {lexicalChoices.map((l) => (
              <Pill
                key={l}
                label={`HSK ${l === 1 ? 1 : `1–${l}`}`}
                active={l === level}
                onPress={() => onLevel(l)}
              />
            ))}
          </PillRow>
        </SettingsSection>
      ) : null}

      <SettingsSection
        label={t.sprint.sectionTimer}
        hint={t.sprint.sectionTimerHint}
      >
        <PillRow>
          {TIMER_PRESETS.map((s) => (
            <Pill
              key={s}
              label={s === 0 ? "∞" : fmt(t.sprint.secondsShort, { n: s })}
              active={s === timerSeconds}
              onPress={() => onTimer(s)}
            />
          ))}
        </PillRow>
      </SettingsSection>

      <SettingsSection label={t.sprint.sectionBehavior}>
        <ToggleRow
          icon={<Zap color={C_RED} size={16} strokeWidth={2.4} fill={C_RED} />}
          iconBg={C_RED_100}
          title={t.sprint.autoReveal}
          subtitle={t.sprint.autoRevealSub}
          value={revealMode === "auto"}
          onChange={(v) => onReveal(v ? "auto" : "manual")}
        />
        <ToggleRow
          icon={
            <ChevronRight color={C_INK_2} size={16} strokeWidth={2.4} />
          }
          iconBg={C_WARM}
          title={t.sprint.autoAdvance}
          subtitle={t.sprint.autoAdvanceSub}
          value={autoAdvanceSeconds > 0}
          onChange={(v) =>
            onAutoAdvance(
              v ? (autoAdvanceSeconds || AUTO_ADVANCE_PRESETS[1] || 2) : 0,
            )
          }
        />
        {autoAdvanceSeconds > 0 ? (
          <View style={{ paddingLeft: 50 }}>
            <PillRow>
              {AUTO_ADVANCE_PRESETS.filter((s) => s > 0).map((s) => (
                <Pill
                  key={s}
                  label={fmt(t.sprint.secondsShort, { n: s })}
                  active={s === autoAdvanceSeconds}
                  onPress={() => onAutoAdvance(s)}
                />
              ))}
            </PillRow>
          </View>
        ) : null}
      </SettingsSection>
    </ScrollView>
  );
}

function SettingsSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            backgroundColor: C_RED,
          }}
        />
        <Text
          style={{
            color: C_RED,
            fontSize: 12,
            lineHeight: 14,
            letterSpacing: 1.4,
            fontFamily: useFontUiBold(),
          }}
        >
          {label}
        </Text>
      </View>
      {hint ? (
        <Text
          style={{
            color: C_INK_3,
            fontSize: 13,
            lineHeight: 18,
            paddingLeft: 13,
          }}
        >
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function useFontUiBold(): string {
  // Tiny indirection so a section header can read the theme font without
  // forcing every section consumer to call useTheme.
  return useTheme().fonts.uiBold;
}

function PresetCard({
  title,
  subtitle,
  icon,
  tileBg,
  active,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tileBg: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: active ? C_INK : C_SURFACE,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: active ? C_INK : C_BORDER,
        padding: 12,
        gap: 8,
        minHeight: 116,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: theme.radii.sm,
          backgroundColor: tileBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: active ? "#FFFFFF" : C_INK,
          fontSize: 15,
          lineHeight: 18,
          fontFamily: theme.fonts.uiBold,
        }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          color: active ? "rgba(255,255,255,0.6)" : C_INK_3,
          fontSize: 11,
          lineHeight: 14,
        }}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {children}
    </View>
  );
}

function Pill({
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: theme.radii.full,
        backgroundColor: active ? C_INK : C_SURFACE,
        borderWidth: 1,
        borderColor: active ? C_INK : C_BORDER,
      }}
    >
      <Text
        style={{
          color: active ? "#FFFFFF" : C_INK,
          fontSize: 13,
          lineHeight: 16,
          fontFamily: theme.fonts.uiSemiBold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingVertical: 12,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: C_SURFACE,
        borderWidth: 1,
        borderColor: C_BORDER,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: theme.radii.sm,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: C_INK,
            fontSize: 15,
            lineHeight: 20,
            fontFamily: theme.fonts.uiSemiBold,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: C_INK_3,
            fontSize: 12,
            lineHeight: 16,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#E5E5EA", true: C_RED }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E5E5EA"
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(1, current / total) : 0;
  return (
    <View
      style={{
        height: 5,
        borderRadius: 3,
        backgroundColor: C_WARM,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          backgroundColor: C_RED,
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseLevel(raw: string | undefined): LexicalLevel | null {
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  return ALL_LEXICAL_LEVELS.find((l) => l === n) ?? null;
}

function parseGrammar(raw: string | undefined): GrammarLevel | null {
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  return ALL_GRAMMAR_LEVELS.find((l) => l === n) ?? null;
}

function formatSeconds(s: number, t: Translations): string {
  if (s < 60) return fmt(t.sprint.secondsShort, { n: s });
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}:00` : `${m}:${r.toString().padStart(2, "0")}`;
}

/** Strip the leading CJK cluster off a construction name. e.g. "把-конструкция"
 *  → "把"; "是…的" → "是…的"; "V起来" → "起来" (V is latin, skipped). */
function extractKeyChar(c: Construction): string {
  const name = c.name || "";
  const match = name.match(/[一-鿿…]+/);
  return match ? match[0] : "";
}

function prettyConstructionName(c: Construction): string {
  // Trim a trailing "-конструкция / -construction" tail so the title doesn't
  // become a tongue-twister; the body subtitle (ru_name / pattern) already
  // adds the "what it does" copy.
  const raw = c.name ?? "";
  return raw.replace(/[\s—-]*(конструкция|construction)\b.*$/i, "").trim() || raw;
}
