import { forwardRef, useState } from "react";
import {
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

export type InputVariant = "text" | "email" | "password" | "search" | "numeric";

export type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  error?: string;
  helper?: string;
  variant?: InputVariant;
  /** Render hanzi / Chinese-safe font. */
  chinese?: boolean;
  containerStyle?: ViewStyle;
  style?: TextInputProps["style"];
};

const variantProps: Record<InputVariant, Partial<TextInputProps>> = {
  text: {},
  email: {
    keyboardType: "email-address",
    autoCapitalize: "none",
    autoCorrect: false,
    autoComplete: "email",
    textContentType: "emailAddress",
  },
  password: {
    secureTextEntry: true,
    autoCapitalize: "none",
    autoCorrect: false,
    autoComplete: "password",
    textContentType: "password",
  },
  search: {
    autoCapitalize: "none",
    returnKeyType: "search",
  },
  numeric: {
    keyboardType: "number-pad",
  },
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    helper,
    variant = "text",
    chinese,
    containerStyle,
    style,
    onFocus,
    onBlur,
    placeholder,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus: NonNullable<TextInputProps["onFocus"]> = (e) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur: NonNullable<TextInputProps["onBlur"]> = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.accent
      : theme.colors.border;

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text variant="smallStrong" color="secondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        {...variantProps[variant]}
        {...rest}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          {
            height: 48,
            paddingHorizontal: 14,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor,
            backgroundColor: theme.colors.surface,
            color: theme.colors.textPrimary,
            fontFamily: chinese ? theme.fonts.chinese : theme.fonts.latin,
            fontSize: theme.typography.body.fontSize,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="small" color="tertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});
