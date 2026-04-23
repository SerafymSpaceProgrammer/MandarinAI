import { ActivityIndicator, StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme, type Theme } from "@/theme";

import { Pressable, type PressableProps } from "./Pressable";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const heights: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };
const horizontalPadding: Record<ButtonSize, number> = { sm: 12, md: 20, lg: 24 };
const textVariant: Record<ButtonSize, "small" | "bodyStrong" | "h3"> = {
  sm: "smallStrong" as any,
  md: "bodyStrong",
  lg: "h3",
};

function variantStyles(theme: Theme, variant: ButtonVariant, disabled: boolean) {
  const alpha = disabled ? 0.5 : 1;
  switch (variant) {
    case "primary":
      return {
        bg: theme.colors.accent,
        border: "transparent",
        text: "onAccent" as const,
        opacity: alpha,
      };
    case "secondary":
      return {
        bg: theme.colors.surface,
        border: theme.colors.border,
        text: "primary" as const,
        opacity: alpha,
      };
    case "ghost":
      return {
        bg: "transparent",
        border: "transparent",
        text: "primary" as const,
        opacity: alpha,
      };
    case "danger":
      return {
        bg: theme.colors.danger,
        border: "transparent",
        text: "onAccent" as const,
        opacity: alpha,
      };
  }
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  leftIcon,
  rightIcon,
  fullWidth,
  style,
  haptic = "medium",
  onPress,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const vs = variantStyles(theme, variant, !!isDisabled);

  const styles: ViewStyle = {
    height: heights[size],
    paddingHorizontal: horizontalPadding[size],
    backgroundColor: vs.bg,
    borderColor: vs.border,
    borderWidth: variant === "secondary" ? 1 : 0,
    borderRadius: theme.radii.md,
    opacity: vs.opacity,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: fullWidth ? "stretch" : "flex-start",
    minWidth: 44,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic={isDisabled ? "none" : haptic}
      onPress={onPress}
      style={[styles, style as ViewStyle]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors[vs.text === "onAccent" ? "onAccent" : "textPrimary"]} />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          <Text variant={textVariant[size]} color={vs.text}>
            {label}
          </Text>
          {rightIcon ? <View>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = StyleSheet; // keep import for future extension
