import type { SubtitleWord } from "./types";

/**
 * Segment Chinese text into displayable, tappable tokens via a longest-match
 * greedy walk against a known-word dictionary. We feed it the union of HSK
 * 1–6 words at module load time so any common compound (你好, 学校, 朋友, 多
 * 少) gets surfaced as one tappable unit instead of split per character.
 *
 * Tokens that aren't in the dictionary fall back to single CJK characters
 * (still tappable — single-char words are common in Mandarin), and any
 * ASCII / punctuation runs are emitted as non-tappable text spans.
 */

const CJK_RE = /[一-鿿]/;

let WORD_SET: Set<string> | null = null;
let MAX_WORD_LEN = 1;

function ensureDict(): Set<string> {
  if (WORD_SET) return WORD_SET;
  // Lazy-bundle the HSK 1–6 word lists; Metro inlines these at build time.
  // The lists are just `[{ hanzi, pinyin }]`, ~6300 total words, so the
  // resulting trie is small (~300KB) and fits comfortably in RAM.
  const lists: Array<Array<{ hanzi: string }>> = [
    require("../../../data/hskwords_old/hsk1_old.json"),
    require("../../../data/hskwords_old/hsk2_old.json"),
    require("../../../data/hskwords_old/hsk3_old.json"),
    require("../../../data/hskwords_old/hsk4_old.json"),
    require("../../../data/hskwords_old/hsk5_old.json"),
    require("../../../data/hskwords_old/hsk6_old.json"),
  ];
  const set = new Set<string>();
  let max = 1;
  for (const list of lists) {
    for (const w of list) {
      const h = w.hanzi;
      if (h && h.length > 0) {
        set.add(h);
        if (h.length > max) max = h.length;
      }
    }
  }
  WORD_SET = set;
  MAX_WORD_LEN = max;
  return set;
}

export function segmentSubtitle(zh: string): SubtitleWord[] {
  const dict = ensureDict();
  const tokens: SubtitleWord[] = [];
  const chars = [...zh];
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i]!;
    if (!CJK_RE.test(ch)) {
      // Group runs of non-CJK characters (punctuation, latin, digits) into a
      // single non-tappable token so the renderer doesn't split "Wi-Fi" or
      // ", " into a dozen spans.
      let buf = ch;
      let j = i + 1;
      while (j < chars.length && !CJK_RE.test(chars[j]!)) {
        buf += chars[j];
        j++;
      }
      tokens.push({ text: buf, tappable: false });
      i = j;
      continue;
    }

    // Greedy longest-match against the HSK dictionary. Cap the window at
    // MAX_WORD_LEN so we don't probe absurdly long substrings.
    let matched: string | null = null;
    const maxLen = Math.min(MAX_WORD_LEN, chars.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const candidate = chars.slice(i, i + len).join("");
      if (dict.has(candidate)) {
        matched = candidate;
        break;
      }
    }
    if (matched) {
      tokens.push({ text: matched, tappable: true });
      i += matched.length;
    } else {
      // Unknown single hanzi — still tappable. The popup will show whatever
      // the dictionary happens to know about that character (or nothing).
      tokens.push({ text: ch, tappable: true });
      i++;
    }
  }

  return tokens;
}
