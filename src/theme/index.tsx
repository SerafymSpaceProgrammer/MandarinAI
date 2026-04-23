import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { colorsByScheme, type ColorScheme, type ThemeColors } from "./colors";
import { fonts, typography } from "./typography";
import { radii, shadows, spacing } from "./spacing";
import { duration, easingBezier } from "./motion";

export type Theme = {
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

const buildTheme = (scheme: ColorScheme): Theme => ({
  scheme,
  colors: colorsByScheme[scheme],
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
  /** Force a scheme (useful for screenshots / storybook). Omit to follow system. */
  forceScheme?: ColorScheme;
};

export function ThemeProvider({ children, forceScheme }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = forceScheme ?? (systemScheme === "dark" ? "dark" : "light");
  const value = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used inside a <ThemeProvider>");
  }
  return theme;
}

export * from "./colors";
export * from "./typography";
export * from "./spacing";
export * from "./motion";
