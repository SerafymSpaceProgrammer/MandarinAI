import { pinyin } from "pinyin-pro";

export function toPinyin(hanzi: string): string {
  return pinyin(hanzi, { toneType: "symbol", separator: " " });
}

export function toPinyinTone(hanzi: string): string {
  return pinyin(hanzi, { toneType: "num", separator: " " });
}
