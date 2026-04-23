export const palette = {
  accent: "#E63946",
  accentHover: "#C92B38",
  accentMuted: "#FCE8EA",

  bg: "#FFFFFF",
  surface: "#F9FAFB",
  surfaceHover: "#F3F4F6",
  border: "#E5E7EB",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",

  bgDark: "#0A0A0A",
  surfaceDark: "#171717",
  surfaceHoverDark: "#262626",
  borderDark: "#2E2E2E",
  textPrimaryDark: "#F5F5F5",
  textSecondaryDark: "#A3A3A3",
  textTertiaryDark: "#737373",

  tone1: "#DC2626",
  tone2: "#16A34A",
  tone3: "#2563EB",
  tone4: "#9333EA",
  toneNeutral: "#6B7280",

  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
} as const;

export type ColorScheme = "light" | "dark";

export const lightColors = {
  accent: palette.accent,
  accentHover: palette.accentHover,
  accentMuted: palette.accentMuted,

  bg: palette.bg,
  surface: palette.surface,
  surfaceHover: palette.surfaceHover,
  border: palette.border,

  textPrimary: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textTertiary: palette.textTertiary,

  tone1: palette.tone1,
  tone2: palette.tone2,
  tone3: palette.tone3,
  tone4: palette.tone4,
  toneNeutral: palette.toneNeutral,

  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,

  onAccent: "#FFFFFF",
  overlay: "rgba(0, 0, 0, 0.4)",
} as const;

export const darkColors = {
  accent: palette.accent,
  accentHover: palette.accentHover,
  accentMuted: "#3A1518",

  bg: palette.bgDark,
  surface: palette.surfaceDark,
  surfaceHover: palette.surfaceHoverDark,
  border: palette.borderDark,

  textPrimary: palette.textPrimaryDark,
  textSecondary: palette.textSecondaryDark,
  textTertiary: palette.textTertiaryDark,

  tone1: "#F87171",
  tone2: "#4ADE80",
  tone3: "#60A5FA",
  tone4: "#C084FC",
  toneNeutral: palette.textTertiaryDark,

  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,

  onAccent: "#FFFFFF",
  overlay: "rgba(0, 0, 0, 0.6)",
} as const;

export type ThemeColors = {
  accent: string;
  accentHover: string;
  accentMuted: string;
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  tone1: string;
  tone2: string;
  tone3: string;
  tone4: string;
  toneNeutral: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  onAccent: string;
  overlay: string;
};

export const colorsByScheme: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
