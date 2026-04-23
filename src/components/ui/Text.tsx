import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { useTheme, type TypographyVariant } from "@/theme";

type TextColor =
  | "primary"
  | "secondary"
  | "tertiary"
  | "accent"
  | "onAccent"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  /** Use Chinese font stack. Apply to any element that may render hanzi. */
  chinese?: boolean;
  /** Tone number 1-4 or 0 (neutral) for tone-colored pinyin. Overrides color. */
  tone?: 0 | 1 | 2 | 3 | 4;
  align?: TextStyle["textAlign"];
};

const colorKey: Record<TextColor, keyof ReturnType<typeof useTheme>["colors"]> = {
  primary: "textPrimary",
  secondary: "textSecondary",
  tertiary: "textTertiary",
  accent: "accent",
  onAccent: "onAccent",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

const toneKey = {
  0: "toneNeutral",
  1: "tone1",
  2: "tone2",
  3: "tone3",
  4: "tone4",
} as const;

export function Text({
  variant = "body",
  color = "primary",
  chinese,
  tone,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const typography = theme.typography[variant];

  const resolvedColor = tone !== undefined ? theme.colors[toneKey[tone]] : theme.colors[colorKey[color]];

  const fontFamily = chinese ? theme.fonts.chinese : theme.fonts.latin;

  return (
    <RNText
      {...rest}
      style={[typography, { color: resolvedColor, fontFamily, textAlign: align }, style]}
    >
      {children}
    </RNText>
  );
}
