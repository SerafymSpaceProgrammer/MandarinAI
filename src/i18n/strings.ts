import type { NativeLanguage } from "@/types";

import { EN, type Translations } from "./strings.en";
import { ES } from "./strings.es";
import { PT } from "./strings.pt";
import { RU } from "./strings.ru";
import { ZH } from "./strings.zh";

export type { Translations };

export const STRINGS: Record<NativeLanguage, Translations> = {
  en: EN,
  es: ES,
  pt: PT,
  ru: RU,
  zh: ZH,
};

/**
 * Substitute {placeholder} tokens in a translated template with runtime args.
 * Unknown keys leave the {…} marker visible — quickly surfaces missing args
 * in dev. Empty args means "no interpolation needed", returns input as-is.
 */
export function fmt(
  template: string,
  args?: Record<string, string | number>,
): string {
  if (!args) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in args ? String(args[key]) : `{${key}}`,
  );
}
