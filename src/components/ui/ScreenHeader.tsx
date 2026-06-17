import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type Props = {
  /** Small uppercase label above the title (e.g. "Studying"). */
  eyebrow?: string;
  /** The screen title rendered as an h1. */
  title: string;
  /** Optional Chinese accent character — placed beside the title in accent color. */
  hanzi?: string;
  /** Subtitle line under the title — short blurb in secondary color. */
  subtitle?: string;
  /** Slot to the right (streak chip, settings icon, etc.). */
  trailing?: ReactNode;
};

/**
 * Branded screen-level header used by every primary tab. Combines the
 * uppercase eyebrow + display title + a small accent bar underneath, plus
 * an optional hanzi marker beside the title that anchors the screen visually
 * without leaning on a hard logo. The accent bar is the signature design
 * element — it's the same in every screen, instantly says "MandarinAI."
 */
export function ScreenHeader({ eyebrow, title, hanzi, subtitle, trailing }: Props) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          {eyebrow ? (
            <Text variant="caption" color="tertiary">
              {eyebrow}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Text variant="h1">{title}</Text>
            {hanzi ? (
              <Text
                chinese
                style={{
                  fontSize: 28,
                  lineHeight: 32,
                  fontWeight: "700",
                  color: theme.colors.accent,
                  opacity: 0.7,
                }}
              >
                {hanzi}
              </Text>
            ) : null}
          </View>
        </View>
        {trailing ? <View>{trailing}</View> : null}
      </View>

      {/* Signature accent bar — 4px tall, ~36px wide, positioned under the title.
          Same on every screen; it's our most consistent branding signal. */}
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.accent,
        }}
      />

      {subtitle ? (
        <Text variant="small" color="secondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
