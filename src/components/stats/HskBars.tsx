import { View } from "react-native";

import { Text } from "@/components/ui";
import type { HskBreakdown } from "@/features/stats/useStats";
import { useTheme } from "@/theme";

type Props = {
  rows: HskBreakdown[];
};

export function HskBars({ rows }: Props) {
  const theme = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {rows.map((r) => {
        const total = r.total;
        const widthPct = total === 0 ? 0 : (total / max) * 100;
        return (
          <View key={r.hskLevel} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="small" color="secondary">
                HSK {r.hskLevel}
              </Text>
              <Text variant="small" color="tertiary">
                {r.mastered} / {total}
              </Text>
            </View>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.colors.surface,
                overflow: "hidden",
                flexDirection: "row",
              }}
            >
              {total === 0 ? null : (
                <View style={{ flexDirection: "row", width: `${widthPct}%` }}>
                  <View
                    style={{
                      flex: r.mastered,
                      backgroundColor: theme.colors.success,
                    }}
                  />
                  <View
                    style={{
                      flex: r.learning,
                      backgroundColor: theme.colors.accent,
                    }}
                  />
                  <View
                    style={{
                      flex: r.new,
                      backgroundColor: theme.colors.textTertiary,
                      opacity: 0.4,
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        );
      })}

      <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: 4 }}>
        <LegendSwatch color={theme.colors.success} label="Mastered" />
        <LegendSwatch color={theme.colors.accent} label="Learning" />
        <LegendSwatch color={theme.colors.textTertiary} label="New" faded />
      </View>
    </View>
  );
}

function LegendSwatch({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, opacity: faded ? 0.4 : 1 }} />
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
    </View>
  );
}
