import {
  ALL_LEXICAL_LEVELS,
  getPhraseTranslation,
  loadPatternsBundle,
  type LexicalLevel,
  type PatternPhrase,
} from "@/features/grammar/patterns";

export type ListeningQuestion = {
  /** The Chinese sentence the TTS should play. */
  zh: string;
  /** Pinyin to reveal after the user answers. */
  py: string;
  /** Translation in the user's native language (canonical answer). */
  answer: string;
  /** Three plausible distractor translations, in user's native language. */
  distractors: string[];
  /** Pre-shuffled choice list with the answer mixed in. */
  choices: string[];
  /** Index of the correct answer inside `choices`. */
  answerIndex: number;
};

export type DrillSession = {
  level: LexicalLevel;
  questions: ListeningQuestion[];
};

const DRILL_SIZE = 10;

/**
 * Build a listening drill at the requested HSK lexical level (1 = HSK 1 only,
 * 6 = HSK 1–6). Phrases are sampled from the HSK 1 grammar pattern bundle for
 * that scope — they're already curated, multilingual, and short enough to
 * play comfortably as a single TTS utterance.
 *
 * Distractors come from other phrases in the same bundle, deduplicated and
 * filtered to avoid near-identical translations (e.g. "Я ем яблоко" /
 * "Я ем яблоки") which would frustrate the user.
 */
export function buildDrill(level: LexicalLevel, lang: string): DrillSession {
  const bundle = loadPatternsBundle(1, level);

  // Flatten every phrase across constructions; we're not filtering by
  // construction here — the goal is varied listening practice, not pattern
  // drilling.
  const allPhrases: PatternPhrase[] = [];
  for (const c of bundle.constructions) {
    for (const p of c.patterns) allPhrases.push(p);
  }

  // Filter to phrases that have a translation in the user's language (with
  // the en/ru fallback chain). Skip phrases too short to challenge ear (≤ 2
  // hanzi) and overly long (> 18 hanzi) which strain TTS in one breath.
  const usable = allPhrases.filter((p) => {
    if (countHanzi(p.zh) < 3 || countHanzi(p.zh) > 18) return false;
    const tr = getPhraseTranslation(p, lang);
    return tr.text.trim().length > 0;
  });

  // Reservoir-style sample of unique phrases by zh.
  const seenZh = new Set<string>();
  const pool: Array<{ phrase: PatternPhrase; answer: string }> = [];
  const shuffled = shuffle(usable);
  for (const p of shuffled) {
    if (seenZh.has(p.zh)) continue;
    seenZh.add(p.zh);
    pool.push({ phrase: p, answer: getPhraseTranslation(p, lang).text });
    if (pool.length >= DRILL_SIZE * 6) break;
  }

  const targets = pool.slice(0, DRILL_SIZE);
  const questions: ListeningQuestion[] = targets.map((t) => {
    const distractors = pickDistractors(t.answer, pool, 3);
    const choices = shuffle([t.answer, ...distractors]);
    const answerIndex = choices.indexOf(t.answer);
    return {
      zh: t.phrase.zh,
      py: t.phrase.py ?? "",
      answer: t.answer,
      distractors,
      choices,
      answerIndex,
    };
  });

  return { level, questions };
}

export function isLexicalLevel(n: number): n is LexicalLevel {
  return (ALL_LEXICAL_LEVELS as readonly number[]).includes(n);
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const CJK_RE = /[一-鿿]/;
function countHanzi(s: string): number {
  let n = 0;
  for (const c of s) if (CJK_RE.test(c)) n++;
  return n;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Pick `n` distractors that aren't trivially close to the answer. Two
 * translations are considered "too close" when one fully contains the other
 * after lowercasing and stripping punctuation — that's the most common cause
 * of frustrating duplicates ("Я хочу есть" vs "Я очень хочу есть").
 */
function pickDistractors(
  answer: string,
  pool: Array<{ phrase: PatternPhrase; answer: string }>,
  n: number,
): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[.,!?…—-]/g, "").trim();
  const a = norm(answer);
  const seen = new Set<string>([a]);
  const out: string[] = [];
  for (const item of shuffle(pool)) {
    if (out.length === n) break;
    const candidate = item.answer;
    const c = norm(candidate);
    if (seen.has(c)) continue;
    if (c.includes(a) || a.includes(c)) continue;
    seen.add(c);
    out.push(candidate);
  }
  // Pad with any remaining pool items if the strict filter starved us — rare,
  // but keeps the UI from rendering with fewer than 4 choices.
  if (out.length < n) {
    for (const item of pool) {
      if (out.length === n) break;
      const c = norm(item.answer);
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(item.answer);
    }
  }
  return out;
}
