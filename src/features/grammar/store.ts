import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { create } from "zustand";

import { logger } from "@/lib/logger";

import {
  ALL_GRAMMAR_LEVELS,
  ALL_LEXICAL_LEVELS,
  DEFAULT_GRAMMAR_LEVEL,
  DEFAULT_LEXICAL_LEVEL,
  type GrammarLevel,
  type LexicalLevel,
} from "./patterns";

const STORAGE_KEY = "@mandarinai/grammar-trainer:v1";

/**
 * How the Chinese answer is revealed:
 *  - "manual" — show button stays until user taps it. Timer is informational only.
 *  - "auto"   — answer auto-reveals when the timer expires.
 *
 * In a Pattern Sprint, the user races their own clock — produce the Chinese
 * sentence within ~2 seconds. Auto-reveal mirrors this forcing function.
 */
export type RevealMode = "manual" | "auto";

export type TrainerSettings = {
  /** Which HSK level's grammar constructions to drill. */
  grammarLevel: GrammarLevel;
  /** Vocabulary scope for example sentences (see PatternsBundle). */
  level: LexicalLevel;
  /** Seconds the Russian sentence is shown before reveal becomes available
   *  (manual) or fires (auto). 0 means "no countdown — reveal immediately". */
  timerSeconds: number;
  revealMode: RevealMode;
  /** Auto-advance to the next phrase after this many seconds on the answer
   *  side. 0 disables auto-advance (user taps Next manually). */
  autoAdvanceSeconds: number;
  /** Zen mode strips the trainer down to the bare prompt → answer flow
   *  (no chips, no cards, no buttons — tap to advance). Detailed mode keeps
   *  the full layout. Persisted so the user's preference sticks. */
  zenMode: boolean;
};

export const TIMER_PRESETS: number[] = [0, 2, 3, 4, 5, 8];
export const AUTO_ADVANCE_PRESETS: number[] = [0, 2, 3, 5];

const DEFAULTS: TrainerSettings = {
  grammarLevel: DEFAULT_GRAMMAR_LEVEL,
  level: DEFAULT_LEXICAL_LEVEL,
  timerSeconds: 4,
  revealMode: "manual",
  autoAdvanceSeconds: 0,
  zenMode: false,
};

type TrainerStore = TrainerSettings & {
  /** True after the persisted settings have been merged in. */
  hydrated: boolean;
  setGrammarLevel: (level: GrammarLevel) => void;
  setLevel: (level: LexicalLevel) => void;
  setTimerSeconds: (seconds: number) => void;
  setRevealMode: (mode: RevealMode) => void;
  setAutoAdvanceSeconds: (seconds: number) => void;
  setZenMode: (zen: boolean) => void;
  hydrate: () => Promise<void>;
};

function isLexicalLevel(n: unknown): n is LexicalLevel {
  return typeof n === "number" && (ALL_LEXICAL_LEVELS as number[]).includes(n);
}

function isGrammarLevel(n: unknown): n is GrammarLevel {
  return typeof n === "number" && (ALL_GRAMMAR_LEVELS as number[]).includes(n);
}

function persist(state: TrainerSettings) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((err) =>
    logger.warn("grammar trainer persist error", err),
  );
}

export const useTrainerSettings = create<TrainerStore>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TrainerSettings>;
        const next: TrainerSettings = {
          grammarLevel: isGrammarLevel(parsed.grammarLevel)
            ? parsed.grammarLevel
            : DEFAULTS.grammarLevel,
          level: isLexicalLevel(parsed.level) ? parsed.level : DEFAULTS.level,
          timerSeconds:
            typeof parsed.timerSeconds === "number" && parsed.timerSeconds >= 0
              ? parsed.timerSeconds
              : DEFAULTS.timerSeconds,
          revealMode:
            parsed.revealMode === "auto" || parsed.revealMode === "manual"
              ? parsed.revealMode
              : DEFAULTS.revealMode,
          autoAdvanceSeconds:
            typeof parsed.autoAdvanceSeconds === "number" &&
            parsed.autoAdvanceSeconds >= 0
              ? parsed.autoAdvanceSeconds
              : DEFAULTS.autoAdvanceSeconds,
          zenMode:
            typeof parsed.zenMode === "boolean"
              ? parsed.zenMode
              : DEFAULTS.zenMode,
        };
        set({ ...next, hydrated: true });
        return;
      }
    } catch (err) {
      logger.warn("grammar trainer hydrate error", err);
    }
    set({ hydrated: true });
  },

  setGrammarLevel: (grammarLevel) => {
    set({ grammarLevel });
    persist({ ...get(), grammarLevel });
  },
  setLevel: (level) => {
    set({ level });
    persist({ ...get(), level });
  },
  setTimerSeconds: (timerSeconds) => {
    set({ timerSeconds });
    persist({ ...get(), timerSeconds });
  },
  setRevealMode: (revealMode) => {
    set({ revealMode });
    persist({ ...get(), revealMode });
  },
  setAutoAdvanceSeconds: (autoAdvanceSeconds) => {
    set({ autoAdvanceSeconds });
    persist({ ...get(), autoAdvanceSeconds });
  },
  setZenMode: (zenMode) => {
    set({ zenMode });
    persist({ ...get(), zenMode });
  },
}));

/**
 * Hook that ensures the persisted settings are loaded before the screen
 * renders user-visible state. Call from any screen that reads the settings.
 */
export function useHydratedTrainerSettings(): TrainerStore {
  const store = useTrainerSettings();
  useEffect(() => {
    if (!store.hydrated) {
      void store.hydrate();
    }
  }, [store.hydrated, store]);
  return store;
}
