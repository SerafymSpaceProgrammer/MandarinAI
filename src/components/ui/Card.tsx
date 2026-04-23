import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

import { Pressable, type PressableProps } from "./Pressable";

type CardPadding = "none" | "sm" | "md" | "lg";
type CardElevation = "none" | "sm" | "md" | "lg";

export type CardProps = {
  children: ReactNode;
  padding?: CardPadding;
  elevation?: CardElevation;
  /** Override background. Defaults to theme surface. */
  surface?: "surface" | "bg";
  radius?: "sm" | "md" | "lg" | "xl";
  bordered?: boolean;
  style?: ViewStyle | ViewStyle[];
  onPress?: PressableProps["onPress"];
  accessibilityLabel?: string;
  disabled?: boolean;
};

const padMap: Record<CardPadding, number> = { none: 0, sm: 12, md: 16, lg: 24 };

export function Card({
  children,
  padding = "md",
  elevation = "sm",
  surface = "surface",
  radius = "lg",
  bordered,
  style,
  onPress,
  accessibilityLabel,
  disabled,
}: CardProps) {
  const theme = useTheme();
  const bg = surface === "surface" ? theme.colors.surface : theme.colors.bg;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: theme.radii[radius],
    padding: padMap[padding],
    borderWidth: bordered ? 1 : 0,
    borderColor: bordered ? theme.colors.border : "transparent",
    ...(elevation === "none" ? {} : theme.shadows[elevation]),
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        disabled={disabled}
        haptic="light"
        pressedScale={0.98}
        style={[containerStyle, style as ViewStyle]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
}
