import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useTheme, type TypographyVariant } from "@/theme";

import { Text } from "./Text";

type Props = {
  /** The section title. */
  label: string;
  /** Optional secondary line below the label. */
  hint?: string;
  /** Slot to the right (e.g. "View all", count, link). */
  trailing?: ReactNode;
  /** Tap handler — turns the whole row into a Pressable. */
  onPress?: () => void;
  /** Defaults to `h3`. Use `h2` for top-of-page section anchors. */
  variant?: Extract<TypographyVariant, "h2" | "h3">;
};

/**
 * Section header used between content blocks on a screen. The 3px accent bar
 * on the left is the signature shared with `ScreenHeader` — every section on
 * every page anchors visually to the same brand line, so the app reads as a
 * single coherent product instead of a stack of unrelated cards.
 */
export function SectionLabel({ label, hint, trailing, onPress, variant = "h3" }: Props) {
  const theme = useTheme();

  const Container: React.ElementType = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={{
        flexDirection: "row",
        alignItems: hint ? "flex-start" : "center",
        gap: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 3,
          height: variant === "h2" ? 24 : 18,
          marginTop: hint ? 4 : 0,
          borderRadius: 2,
          backgroundColor: theme.colors.accent,
        }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant={variant}>{label}</Text>
        {hint ? (
          <Text variant="small" color="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </Container>
  );
}
