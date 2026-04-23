import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StatusBar, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Background surface. Defaults to theme bg. */
  surface?: "bg" | "surface";
  /** Safe-area edges to respect. Default: top+bottom. */
  edges?: Edge[];
  /** Disable keyboard avoiding (default: enabled on iOS). */
  noKeyboardAvoid?: boolean;
  /** Inner padding. Default: theme.spacing.lg horizontal, 0 vertical. */
  padded?: boolean;
};

export function Screen({
  children,
  style,
  surface = "bg",
  edges = ["top", "bottom", "left", "right"],
  noKeyboardAvoid,
  padded,
}: ScreenProps) {
  const theme = useTheme();
  const bg = surface === "bg" ? theme.colors.bg : theme.colors.surface;
  const innerPadding: ViewStyle = padded
    ? { paddingHorizontal: theme.spacing.lg }
    : {};

  const content = (
    <View style={[styles.inner, innerPadding, style]}>{children}</View>
  );

  const wrapped = noKeyboardAvoid ? (
    content
  ) : (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      {content}
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: bg }]}>
      <StatusBar barStyle={theme.scheme === "dark" ? "light-content" : "dark-content"} />
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { flex: 1 },
});
