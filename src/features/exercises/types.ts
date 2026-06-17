import type { SavedWord } from "@/features/vocab/vocab";

export type ExerciseType =
  | "translate"
  | "listen-and-pick"
  | "match-pairs"
  | "tone-id"
  | "tone-pronounce"
  | "word-order"
  | "fill-blank";

export type ExerciseMeta = {
  type: ExerciseType;
  label: string;
  emoji: string;
  hint: string;
  /** Minimum saved-word count required for this type to be offered. */
  minWords: number;
  /** Whether this type needs some words to have context_sentence. */
  needsContext?: boolean;
};

/**
 * Maps each exercise type to its label/hint keys in `t.exercises.types`.
 * Use this together with `useT()` to render localized copy without
 * duplicating the mapping in every consumer.
 */
export const EXERCISE_I18N_KEYS: Record<
  ExerciseType,
  {
    label:
      | "translateLabel"
      | "listenPickLabel"
      | "matchPairsLabel"
      | "toneIdLabel"
      | "tonePronounceLabel"
      | "wordOrderLabel"
      | "fillBlankLabel";
    hint:
      | "translateHint"
      | "listenPickHint"
      | "matchPairsHint"
      | "toneIdHint"
      | "tonePronounceHint"
      | "wordOrderHint"
      | "fillBlankHint";
  }
> = {
  translate: { label: "translateLabel", hint: "translateHint" },
  "listen-and-pick": { label: "listenPickLabel", hint: "listenPickHint" },
  "match-pairs": { label: "matchPairsLabel", hint: "matchPairsHint" },
  "tone-id": { label: "toneIdLabel", hint: "toneIdHint" },
  "tone-pronounce": { label: "tonePronounceLabel", hint: "tonePronounceHint" },
  "word-order": { label: "wordOrderLabel", hint: "wordOrderHint" },
  "fill-blank": { label: "fillBlankLabel", hint: "fillBlankHint" },
};

export const EXERCISE_META: Record<ExerciseType, ExerciseMeta> = {
  translate: {
    type: "translate",
    label: "Translate",
    emoji: "🔁",
    hint: "Match hanzi to meaning",
    minWords: 4,
  },
  "listen-and-pick": {
    type: "listen-and-pick",
    label: "Listen & pick",
    emoji: "🎧",
    hint: "Hear the word, tap the hanzi",
    minWords: 4,
  },
  "match-pairs": {
    type: "match-pairs",
    label: "Match pairs",
    emoji: "🧩",
    hint: "Connect 5 hanzi to 5 meanings",
    minWords: 5,
  },
  "tone-id": {
    type: "tone-id",
    label: "Tone ID",
    emoji: "🎼",
    hint: "Hear the syllable, pick the tone",
    minWords: 3,
  },
  "tone-pronounce": {
    type: "tone-pronounce",
    label: "Pronounce tone",
    emoji: "🎙️",
    hint: "Say it out loud — we score the tone on-device",
    minWords: 3,
  },
  "word-order": {
    type: "word-order",
    label: "Word order",
    emoji: "📝",
    hint: "Build the sentence in order",
    minWords: 2,
    needsContext: true,
  },
  "fill-blank": {
    type: "fill-blank",
    label: "Fill the blank",
    emoji: "⬜",
    hint: "Complete the sentence",
    minWords: 4,
    needsContext: true,
  },
};

/** Generated exercise variants — one union per exercise type. */
export type TranslateQuestion = {
  type: "translate";
  word: SavedWord;
  direction: "zh_to_en" | "en_to_zh";
  options: string[]; // 4 options in shuffled order
  correct: string;
};

export type ListenPickQuestion = {
  type: "listen-and-pick";
  word: SavedWord;
  options: string[]; // 4 hanzi options shuffled
};

export type MatchPairsQuestion = {
  type: "match-pairs";
  pairs: Array<{ hanzi: string; english: string }>; // exactly 5
};

export type ToneIdQuestion = {
  type: "tone-id";
  word: SavedWord;
  /** The tone under test: 1-4 (neutral-5 omitted for MVP). */
  tone: 1 | 2 | 3 | 4;
};

/**
 * "Speak the tone" exercise — the user sees a single hanzi + its pinyin,
 * records themselves saying it, and the on-device tone scorer evaluates
 * the pitch contour. No multiple-choice options — feedback comes from the
 * recorded audio analysis.
 */
export type TonePronounceQuestion = {
  type: "tone-pronounce";
  word: SavedWord;
  /** Expected tone in 1..5 (5 = neutral). */
  tone: 1 | 2 | 3 | 4 | 5;
};

export type WordOrderQuestion = {
  type: "word-order";
  word: SavedWord;
  /** The sentence, tokenised into display chunks (each usually 1-3 hanzi). */
  tokens: string[];
  /** The correct order (indices into the pre-shuffle tokens). */
  answer: string[];
  /** Tokens shuffled for the bank. */
  shuffled: string[];
  english: string;
};

export type FillBlankQuestion = {
  type: "fill-blank";
  word: SavedWord;
  /** Sentence with the target hanzi replaced by "___". */
  sentenceWithBlank: string;
  english: string;
  correct: string;
  options: string[]; // 4 options including correct
};

export type Question =
  | TranslateQuestion
  | ListenPickQuestion
  | MatchPairsQuestion
  | ToneIdQuestion
  | TonePronounceQuestion
  | WordOrderQuestion
  | FillBlankQuestion;
