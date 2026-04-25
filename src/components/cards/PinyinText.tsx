import { type TextStyle } from "react-native";

import { Text } from "@/components/ui";
import type { TypographyVariant } from "@/theme";

import { detectTone, splitSyllables } from "@/lib/pinyinTones";

type Props = {
  pinyin: string;
  variant?: TypographyVariant;
  /** Render tones as colored text. Default true; pass false for plain pinyin. */
  colored?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
  align?: TextStyle["textAlign"];
};

/**
 * Render a pinyin string with each syllable colored by its tone. Falls back
 * to a single-color render when `colored` is false. Renders as one Text
 * element with nested children so it inherits its parent's line-height.
 */
export function PinyinText({
  pinyin,
  variant = "pinyin",
  colored = true,
  style,
  numberOfLines,
  align,
}: Props) {
  if (!colored) {
    return (
      <Text variant={variant} color="secondary" style={style} numberOfLines={numberOfLines} align={align}>
        {pinyin}
      </Text>
    );
  }

  const syllables = splitSyllables(pinyin);
  if (syllables.length === 0) {
    return null;
  }

  return (
    <Text variant={variant} style={style} numberOfLines={numberOfLines} align={align}>
      {syllables.map((sy, i) => (
        <Text key={`${sy}-${i}`} variant={variant} tone={detectTone(sy)}>
          {i > 0 ? " " : ""}
          {sy}
        </Text>
      ))}
    </Text>
  );
}
