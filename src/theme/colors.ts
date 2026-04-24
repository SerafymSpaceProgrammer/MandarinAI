import type { AppThemeId } from "@/types";

export type ColorScheme = "light" | "dark";

export type ThemeColors = {
  // Brand
  accent: string;
  accentHover: string;
  accentMuted: string;
  onAccent: string;

  // Surfaces
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // Tones (for pinyin)
  tone1: string;
  tone2: string;
  tone3: string;
  tone4: string;
  toneNeutral: string;

  // Status
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Utilities
  overlay: string;
};

/**
 * A concrete theme definition. Every theme is self-contained — the only thing
 * the ThemeProvider does at runtime is resolve `system` → `light` or `dark`.
 */
export type AppTheme = {
  id: Exclude<AppThemeId, "system">;
  name: string;
  emoji: string;
  scheme: ColorScheme;
  colors: ThemeColors;
};

// ──────────────────────────────────────────────────────────────────────────
// Shared palette pieces
// ──────────────────────────────────────────────────────────────────────────
const STATUS = {
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
} as const;

const TONES_LIGHT = {
  tone1: "#DC2626",
  tone2: "#16A34A",
  tone3: "#2563EB",
  tone4: "#9333EA",
  toneNeutral: "#6B7280",
} as const;

const TONES_DARK = {
  tone1: "#F87171",
  tone2: "#4ADE80",
  tone3: "#60A5FA",
  tone4: "#C084FC",
  toneNeutral: "#A3A3A3",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Themes — palettes mirror the ChineseLens extension (src/shared/theme.ts)
// ──────────────────────────────────────────────────────────────────────────
const light: AppTheme = {
  id: "light",
  name: "Light",
  emoji: "☀️",
  scheme: "light",
  colors: {
    accent: "#E63946",
    accentHover: "#C92B38",
    accentMuted: "#FCE8EA",
    onAccent: "#FFFFFF",

    bg: "#FFFFFF",
    surface: "#F9FAFB",
    surfaceHover: "#F3F4F6",
    border: "#E5E7EB",

    textPrimary: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",

    ...TONES_LIGHT,
    ...STATUS,

    overlay: "rgba(0, 0, 0, 0.4)",
  },
};

const dark: AppTheme = {
  id: "dark",
  name: "Dark",
  emoji: "🌙",
  scheme: "dark",
  colors: {
    accent: "#E63946",
    accentHover: "#C92B38",
    accentMuted: "#3A1518",
    onAccent: "#FFFFFF",

    bg: "#0A0A0A",
    surface: "#171717",
    surfaceHover: "#262626",
    border: "#2E2E2E",

    textPrimary: "#F5F5F5",
    textSecondary: "#A3A3A3",
    textTertiary: "#737373",

    ...TONES_DARK,
    ...STATUS,

    overlay: "rgba(0, 0, 0, 0.6)",
  },
};

const sakura: AppTheme = {
  id: "sakura",
  name: "Sakura",
  emoji: "🌸",
  scheme: "light",
  colors: {
    accent: "#E63946",
    accentHover: "#C92B38",
    accentMuted: "#FFD6DC",
    onAccent: "#FFFFFF",

    bg: "#FFF5F6",
    surface: "#FFE8EC",
    surfaceHover: "#FFD6DC",
    border: "#FFAAB8",

    textPrimary: "#2D1518",
    textSecondary: "#8B4A52",
    textTertiary: "#B07880",

    ...TONES_LIGHT,
    ...STATUS,

    overlay: "rgba(45, 21, 24, 0.4)",
  },
};

const bamboo: AppTheme = {
  id: "bamboo",
  name: "Bamboo",
  emoji: "🎋",
  scheme: "light",
  colors: {
    accent: "#16A34A",
    accentHover: "#15803D",
    accentMuted: "#BBF7D0",
    onAccent: "#FFFFFF",

    bg: "#F0FDF4",
    surface: "#DCFCE7",
    surfaceHover: "#BBF7D0",
    border: "#86EFAC",

    textPrimary: "#14532D",
    textSecondary: "#15803D",
    textTertiary: "#4ADE80",

    ...TONES_LIGHT,
    ...STATUS,

    overlay: "rgba(20, 83, 45, 0.4)",
  },
};

const midnight: AppTheme = {
  id: "midnight",
  name: "Midnight",
  emoji: "🌊",
  scheme: "dark",
  colors: {
    accent: "#3B82F6",
    accentHover: "#2563EB",
    accentMuted: "#1E3A8A",
    onAccent: "#FFFFFF",

    bg: "#020617",
    surface: "#0F172A",
    surfaceHover: "#1E293B",
    border: "#334155",

    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    textTertiary: "#64748B",

    ...TONES_DARK,
    ...STATUS,

    overlay: "rgba(0, 0, 0, 0.7)",
  },
};

const parchment: AppTheme = {
  id: "parchment",
  name: "Parchment",
  emoji: "📜",
  scheme: "light",
  colors: {
    accent: "#EA580C",
    accentHover: "#C2410C",
    accentMuted: "#FED7AA",
    onAccent: "#FFFFFF",

    bg: "#FFFBF0",
    surface: "#FFF3D0",
    surfaceHover: "#FFE8A8",
    border: "#E8D080",

    textPrimary: "#3D2B00",
    textSecondary: "#7A5500",
    textTertiary: "#A87830",

    ...TONES_LIGHT,
    ...STATUS,

    overlay: "rgba(61, 43, 0, 0.45)",
  },
};

export const APP_THEMES: readonly AppTheme[] = [
  light,
  dark,
  sakura,
  bamboo,
  midnight,
  parchment,
] as const;

const THEME_MAP: Record<AppTheme["id"], AppTheme> = {
  light,
  dark,
  sakura,
  bamboo,
  midnight,
  parchment,
};

/**
 * Resolve a theme id (including "system") + the current system scheme into a
 * concrete AppTheme. Unknown ids fall back to light.
 */
export function resolveAppTheme(
  id: AppThemeId | null | undefined,
  systemScheme: ColorScheme,
): AppTheme {
  if (!id || id === "system") {
    return systemScheme === "dark" ? dark : light;
  }
  return THEME_MAP[id] ?? light;
}
