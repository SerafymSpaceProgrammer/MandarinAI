import { pinyin } from "pinyin-pro";

import type { SavedWord } from "@/features/vocab/vocab";

import type {
  ExerciseType,
  FillBlankQuestion,
  ListenPickQuestion,
  MatchPairsQuestion,
  Question,
  ToneIdQuestion,
  TranslateQuestion,
  WordOrderQuestion,
} from "./types";

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickN<T>(arr: T[], n: number, exclude: T[] = []): T[] {
  return shuffle(arr.filter((a) => !exclude.includes(a))).slice(0, n);
}

function primaryToneOf(pinyinStr: string): 1 | 2 | 3 | 4 | null {
  // Normalize the first syllable only; good enough for single-character tones.
  try {
    const numeric = pinyin(pinyinStr, { toneType: "num", type: "array" });
    const first = (Array.isArray(numeric) ? numeric[0] : numeric)?.toString() ?? "";
    const m = first.match(/([1-4])/);
    return m ? (Number(m[1]) as 1 | 2 | 3 | 4) : null;
  } catch {
    return null;
  }
}

function tokenizeSentence(sentence: string, target: string): string[] {
  // Split into runs of (target | CJK char | non-CJK). We keep the target as
  // a single chunk so it stays atomic when shown in the bank.
  const out: string[] = [];
  let i = 0;
  while (i < sentence.length) {
    if (sentence.startsWith(target, i) && target.length > 0) {
      out.push(target);
      i += target.length;
      continue;
    }
    const ch = sentence[i];
    if (!ch) break;
    // One CJK ideograph at a time — good enough for HSK-level sentences.
    if (/[一-鿿]/.test(ch)) {
      out.push(ch);
      i += 1;
    } else {
      // Collapse ASCII/punct runs.
      let j = i + 1;
      while (j < sentence.length) {
        const next = sentence[j];
        if (!next || /[一-鿿]/.test(next)) break;
        j += 1;
      }
      const run = sentence.slice(i, j).trim();
      if (run) out.push(run);
      i = j;
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Per-type builders
// ──────────────────────────────────────────────────────────────────────

function buildTranslate(word: SavedWord, pool: SavedWord[]): TranslateQuestion {
  const direction: "zh_to_en" | "en_to_zh" = Math.random() < 0.5 ? "zh_to_en" : "en_to_zh";
  const distractors = pickN(
    pool.filter((p) => p.hanzi !== word.hanzi),
    3,
  );
  const correct = direction === "zh_to_en" ? word.english : word.hanzi;
  const distractorTexts = distractors.map((d) =>
    direction === "zh_to_en" ? d.english : d.hanzi,
  );
  return {
    type: "translate",
    word,
    direction,
    options: shuffle([correct, ...distractorTexts]),
    correct,
  };
}

function buildListenPick(word: SavedWord, pool: SavedWord[]): ListenPickQuestion {
  const distractors = pickN(
    pool.filter((p) => p.hanzi !== word.hanzi),
    3,
  );
  return {
    type: "listen-and-pick",
    word,
    options: shuffle([word.hanzi, ...distractors.map((d) => d.hanzi)]),
  };
}

function buildMatchPairs(pool: SavedWord[]): MatchPairsQuestion | null {
  const picked = pickN(pool, 5);
  if (picked.length < 5) return null;
  return {
    type: "match-pairs",
    pairs: picked.map((w) => ({ hanzi: w.hanzi, english: w.english })),
  };
}

function buildToneId(word: SavedWord): ToneIdQuestion | null {
  const tone = primaryToneOf(word.hanzi) ?? primaryToneOf(word.pinyin);
  if (!tone) return null;
  return { type: "tone-id", word, tone };
}

function buildWordOrder(word: SavedWord): WordOrderQuestion | null {
  const sentence = (word.context_sentence ?? "").trim();
  if (!sentence || sentence.length < 4) return null;

  const tokens = tokenizeSentence(sentence, word.hanzi);
  if (tokens.length < 3 || tokens.length > 10) return null;

  const shuffled = shuffle(tokens);
  // Guard against the "already in order" case — reshuffle once.
  if (shuffled.join("") === tokens.join("")) {
    shuffled.reverse();
  }
  return {
    type: "word-order",
    word,
    tokens,
    answer: tokens,
    shuffled,
    english: word.english,
  };
}

function buildFillBlank(word: SavedWord, pool: SavedWord[]): FillBlankQuestion | null {
  const sentence = (word.context_sentence ?? "").trim();
  if (!sentence || !sentence.includes(word.hanzi)) return null;

  const blank = "___";
  const sentenceWithBlank = sentence.replace(word.hanzi, blank);
  if (!sentenceWithBlank.includes(blank)) return null;

  const distractors = pickN(
    pool.filter((p) => p.hanzi !== word.hanzi),
    3,
  );
  return {
    type: "fill-blank",
    word,
    sentenceWithBlank,
    english: word.english,
    correct: word.hanzi,
    options: shuffle([word.hanzi, ...distractors.map((d) => d.hanzi)]),
  };
}

/**
 * Produce up to `count` questions of a given type from the user's saved_words
 * deck. Returns [] if the deck can't satisfy the type (e.g. no context
 * sentences available for fill-blank). Never throws.
 */
export function generateExercises(
  type: ExerciseType,
  words: SavedWord[],
  count = 10,
): Question[] {
  const uniqueWords = words.filter(
    (w, i, arr) => arr.findIndex((a) => a.hanzi === w.hanzi) === i,
  );
  if (uniqueWords.length === 0) return [];

  if (type === "match-pairs") {
    // Each question consumes 5 words; offer up to count rounds but also
    // don't repeat the same pool.
    const rounds = Math.min(count, Math.floor(uniqueWords.length / 5));
    const out: Question[] = [];
    let bucket = shuffle(uniqueWords);
    for (let i = 0; i < rounds; i++) {
      const sliceStart = i * 5;
      const slice = bucket.slice(sliceStart, sliceStart + 5);
      if (slice.length < 5) {
        bucket = shuffle(uniqueWords);
      }
      const q = buildMatchPairs(slice.length >= 5 ? slice : bucket.slice(0, 5));
      if (q) out.push(q);
    }
    return out;
  }

  const pool = shuffle(uniqueWords);
  const out: Question[] = [];
  for (const word of pool) {
    if (out.length >= count) break;
    let q: Question | null = null;
    switch (type) {
      case "translate":
        q = buildTranslate(word, uniqueWords);
        break;
      case "listen-and-pick":
        q = buildListenPick(word, uniqueWords);
        break;
      case "tone-id":
        q = buildToneId(word);
        break;
      case "word-order":
        q = buildWordOrder(word);
        break;
      case "fill-blank":
        q = buildFillBlank(word, uniqueWords);
        break;
    }
    if (q) out.push(q);
  }
  return out;
}
