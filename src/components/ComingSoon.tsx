import type { LucideProps } from "lucide-react-native";
import { View } from "react-native";

import { Screen, Text } from "@/components/ui";
import { useTheme } from "@/theme";

type Props = {
  Icon: React.ComponentType<LucideProps>;
  title: string;
  hint: string;
  phase: string;
};

/**
 * Placeholder for tabs whose features live in later phases.
 * Keeps routing/bottom-nav in place so users understand where to come back.
 */
export function ComingSoon({ Icon, title, hint, phase }: Props) {
  const theme = useTheme();
  return (
    <Screen padded>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: theme.colors.accentMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon color={theme.colors.accent} size={40} strokeWidth={1.8} />
        </View>
        <Text variant="h2" align="center">
          {title}
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ paddingHorizontal: theme.spacing.xl }}>
          {hint}
        </Text>
        <View style={{ height: theme.spacing.sm }} />
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 12,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.full,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text variant="caption" color="tertiary">
            {phase}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
