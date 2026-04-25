/**
 * Detect the tone (1-4, or 0 for neutral) of a single pinyin syllable from its
 * diacritics. Cheap and self-contained — avoids pulling pinyin-pro into list
 * components for what's essentially a character lookup.
 */
const TONE_BY_CHAR: Record<string, 0 | 1 | 2 | 3 | 4> = {
  ā: 1, ē: 1, ī: 1, ō: 1, ū: 1, ǖ: 1, Ā: 1, Ē: 1, Ī: 1, Ō: 1, Ū: 1, Ǖ: 1,
  á: 2, é: 2, í: 2, ó: 2, ú: 2, ǘ: 2, Á: 2, É: 2, Í: 2, Ó: 2, Ú: 2, Ǘ: 2,
  ǎ: 3, ě: 3, ǐ: 3, ǒ: 3, ǔ: 3, ǚ: 3, Ǎ: 3, Ě: 3, Ǐ: 3, Ǒ: 3, Ǔ: 3, Ǚ: 3,
  à: 4, è: 4, ì: 4, ò: 4, ù: 4, ǜ: 4, À: 4, È: 4, Ì: 4, Ò: 4, Ù: 4, Ǜ: 4,
};

export function detectTone(syllable: string): 0 | 1 | 2 | 3 | 4 {
  for (const ch of syllable) {
    const t = TONE_BY_CHAR[ch];
    if (t !== undefined) return t;
  }
  return 0;
}

/**
 * Split a pinyin string into syllables. Most CC-CEDICT-style pinyin is space-
 * separated already (e.g. "nǐ hǎo"), but some sources collapse it ("nǐhǎo").
 * For the collapsed case we fall back to whitespace-only chunks.
 */
export function splitSyllables(pinyin: string): string[] {
  const trimmed = pinyin.trim();
  if (!trimmed) return [];
  if (/\s/.test(trimmed)) return trimmed.split(/\s+/);
  return [trimmed];
}
