import storiesJson from "../../../data/stories/stories.json";

/**
 * One comprehension question. Used by the listening-scenario flow after
 * the audio playback finishes — questions are in English to match the
 * story summaries (no per-language translation table to maintain).
 */
export type ComprehensionQuestion = {
  q: string;
  a: string;
  distractors: string[];
};

export type GradedStory = {
  id: string;
  hskLevel: 1 | 2 | 3;
  emoji: string;
  /** Chinese title — shown big on the story card. */
  titleZh: string;
  /** Pinyin of the title — shown under the hanzi. */
  pinyinTitle: string;
  /** Short English summary — shown on the catalog row. */
  summaryEn: string;
  /** Estimated reading time in minutes. */
  durationMin: number;
  /** Full Chinese text of the story. */
  bodyZh: string;
  /** Optional 3-question listening quiz. Older bundles may omit this. */
  comprehension?: ComprehensionQuestion[];
};

type Bundle = {
  version: number;
  stories: GradedStory[];
};

const bundle = storiesJson as Bundle;

export const STORIES: readonly GradedStory[] = Object.freeze([...bundle.stories]);

export const STORY_LEVELS: readonly (1 | 2 | 3)[] = [1, 2, 3] as const;

export function findStory(id: string): GradedStory | null {
  return STORIES.find((s) => s.id === id) ?? null;
}

export function storiesAtLevel(level: 1 | 2 | 3 | "all"): readonly GradedStory[] {
  if (level === "all") return STORIES;
  return STORIES.filter((s) => s.hskLevel === level);
}

/** Stories that have at least one comprehension question — eligible for listening. */
export function storiesWithComprehension(level: 1 | 2 | 3 | "all"): readonly GradedStory[] {
  return storiesAtLevel(level).filter(
    (s) => Array.isArray(s.comprehension) && s.comprehension.length > 0,
  );
}

/** Approximate hanzi count — used for "230 字 · 4 min" rows. */
const CJK_RE = /[一-鿿]/;
export function countHanzi(text: string): number {
  let n = 0;
  for (const ch of text) if (CJK_RE.test(ch)) n++;
  return n;
}
