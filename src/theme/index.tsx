import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { useUserStore } from "@/stores/userStore";
import type { AppThemeId } from "@/types";

import {
  APP_THEMES,
  resolveAppTheme,
  type AppTheme,
  type ColorScheme,
  type ThemeColors,
} from "./colors";
import { fonts, typography } from "./typography";
import { radii, shadows, spacing } from "./spacing";
import { duration, easingBezier } from "./motion";

export type Theme = {
  /** Concrete theme id actually in use (never "system"). */
  themeId: AppTheme["id"];
  /** User's stored preference; may be "system". */
  preferenceId: AppThemeId;
  /** Light/dark flag derived from the active theme. */
  scheme: ColorScheme;
  colors: ThemeColors;
  fonts: typeof fonts;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  duration: typeof duration;
  easing: typeof easingBezier;
};

const buildTheme = (app: AppTheme, preferenceId: AppThemeId): Theme => ({
  themeId: app.id,
  preferenceId,
  scheme: app.scheme,
  colors: app.colors,
  fonts,
  typography,
  spacing,
  radii,
  shadows,
  duration,
  easing: easingBezier,
});

const ThemeContext = createContext<Theme | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  /** Force a theme id (useful for screenshots / storybook). Omit to follow the user's preference. */
  forceThemeId?: AppThemeId;
};

export function ThemeProvider({ children, forceThemeId }: ThemeProviderProps) {
  const systemRaw = useColorScheme();
  const systemScheme: ColorScheme = systemRaw === "dark" ? "dark" : "light";

  // Read the user's persisted preference from the profile. When there is no
  // profile yet (auth / onboarding screens) we fall through to "system".
  const profilePref = useUserStore((s) => s.profile?.app_theme);
  const preferenceId: AppThemeId = forceThemeId ?? profilePref ?? "system";

  const value = useMemo<Theme>(() => {
    const app = resolveAppTheme(preferenceId, systemScheme);
    return buildTheme(app, preferenceId);
  }, [preferenceId, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used inside a <ThemeProvider>");
  }
  return theme;
}

export { APP_THEMES };
export type { AppTheme, AppThemeId, ColorScheme, ThemeColors };
export * from "./typography";
export * from "./spacing";
export * from "./motion";
