import { pinyin } from "pinyin-pro";
import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui";
import { detectTone } from "@/lib/pinyinTones";
import { useTheme } from "@/theme";

type Props = {
  hanzi: string;
  /** Optional whole-sentence pinyin from the dataset. Currently unused for
   *  rendering — we re-derive per-character pinyin from pinyin-pro so each
   *  syllable can be tone-coloured beneath its character — but kept for future
   *  fall-back if pinyin-pro disagrees with a curated reading. */
  fallbackPinyin?: string;
  /** Pixel size of the hanzi glyph. Pinyin is sized proportionally. */
  hanziSize?: number;
  /** Optional set of characters to render in the brand-accent colour (both
   *  the hanzi glyph and its pinyin syllable). Used by the Sprint reveal card
   *  to highlight the construction's key character — e.g. 把 in "我把门关了". */
  accentChars?: string;
  /** Render the pinyin row BELOW the hanzi instead of above. Sprint reveal
   *  uses this layout to keep the chinese glyph as the most prominent line. */
  pinyinBelow?: boolean;
};

type Token =
  | { kind: "hanzi"; char: string; py: string; tone: 0 | 1 | 2 | 3 | 4 }
  | { kind: "punct"; char: string };

const CJK_RE = /[一-鿿]/;

function tokenize(hanzi: string): Token[] {
  // pinyin-pro gives us a syllable per CJK character when called with
  // `type: 'array'`. Non-CJK characters (punctuation, spaces) are kept
  // verbatim and rendered with no pinyin row.
  const cjkChars = [...hanzi].filter((c) => CJK_RE.test(c));
  let pyArr: string[] = [];
  try {
    const result = pinyin(cjkChars.join(""), {
      type: "array",
      toneType: "symbol",
      v: true,
    });
    pyArr = Array.isArray(result) ? result : [];
  } catch {
    pyArr = [];
  }

  const tokens: Token[] = [];
  let pyIdx = 0;
  for (const ch of hanzi) {
    if (CJK_RE.test(ch)) {
      const py = pyArr[pyIdx] ?? "";
      pyIdx += 1;
      tokens.push({ kind: "hanzi", char: ch, py, tone: detectTone(py) });
    } else {
      tokens.push({ kind: "punct", char: ch });
    }
  }
  return tokens;
}

export function HanziWithPinyin({
  hanzi,
  fallbackPinyin: _fallbackPinyin,
  hanziSize = 36,
  accentChars,
  pinyinBelow = false,
}: Props) {
  const theme = useTheme();
  const tokens = useMemo(() => tokenize(hanzi), [hanzi]);
  const pinyinSize = Math.max(12, Math.round(hanziSize * 0.42));
  const accentSet = useMemo(
    () => new Set(accentChars ? [...accentChars] : []),
    [accentChars],
  );

  function renderPinyin(tok: Extract<Token, { kind: "hanzi" }>) {
    const isAccent = accentSet.has(tok.char);
    return (
      <Text
        tone={isAccent ? undefined : tok.tone}
        style={{
          fontSize: pinyinSize,
          lineHeight: pinyinSize + 4,
          fontWeight: "500",
          marginBottom: pinyinBelow ? 0 : 2,
          marginTop: pinyinBelow ? 2 : 0,
          color: isAccent ? theme.colors.accent : undefined,
        }}
        numberOfLines={1}
      >
        {tok.py}
      </Text>
    );
  }

  function renderHanzi(tok: Extract<Token, { kind: "hanzi" | "punct" }>) {
    const isAccent =
      tok.kind === "hanzi" ? accentSet.has(tok.char) : false;
    return (
      <Text
        chinese
        style={{
          fontSize: hanziSize,
          lineHeight: hanziSize * 1.1,
          fontWeight: "700",
          color: isAccent ? theme.colors.accent : undefined,
        }}
      >
        {tok.char}
      </Text>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: theme.spacing.sm,
        columnGap: 2,
        justifyContent: "center",
      }}
    >
      {tokens.map((tok, i) => {
        if (tok.kind === "punct") {
          return (
            <View
              key={i}
              style={{
                alignItems: "center",
                justifyContent: pinyinBelow ? "flex-start" : "flex-end",
              }}
            >
              {!pinyinBelow ? <View style={{ height: pinyinSize + 4 }} /> : null}
              {renderHanzi(tok)}
              {pinyinBelow ? <View style={{ height: pinyinSize + 4 }} /> : null}
            </View>
          );
        }

        return (
          <View
            key={i}
            style={{
              alignItems: "center",
              minWidth: hanziSize,
              paddingHorizontal: 2,
            }}
          >
            {pinyinBelow ? renderHanzi(tok) : renderPinyin(tok)}
            {pinyinBelow ? renderPinyin(tok) : renderHanzi(tok)}
          </View>
        );
      })}
    </View>
  );
}
