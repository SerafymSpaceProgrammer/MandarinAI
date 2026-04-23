import { Platform } from "react-native";

const systemSans = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "System",
});

const systemChinese = Platform.select({
  ios: "PingFang SC",
  android: "Noto Sans CJK SC",
  default: "System",
});

export const fonts = {
  latin: systemSans as string,
  chinese: systemChinese as string,
} as const;

export const typography = {
  display: { fontSize: 48, fontWeight: "700" as const, letterSpacing: -0.96, lineHeight: 52 },
  h1: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.32, lineHeight: 38 },
  h2: { fontSize: 24, fontWeight: "600" as const, lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: "600" as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodyStrong: { fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
  small: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  smallStrong: { fontSize: 14, fontWeight: "600" as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "500" as const, letterSpacing: 0.6, lineHeight: 16, textTransform: "uppercase" as const },

  heroHanzi: { fontSize: 96, fontWeight: "700" as const, lineHeight: 104 },
  tooltipHanzi: { fontSize: 36, fontWeight: "700" as const, lineHeight: 44 },
  pinyin: { fontSize: 20, fontWeight: "500" as const, lineHeight: 26 },
} as const;

export type TypographyVariant = keyof typeof typography;
