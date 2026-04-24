import { useMemo } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui";
import type { DailyActivityRow } from "@/features/activity/activity";
import { useTheme } from "@/theme";

const WEEKS = 13; // 91 days = ~13 weeks
const CELL = 14;
const GAP = 3;

/**
 * GitHub-style contributions grid: 7 rows (days of week, Mon→Sun) ×
 * WEEKS columns, colored by that day's xp_earned.
 */
export function Heatmap({ activity }: { activity: DailyActivityRow[] }) {
  const theme = useTheme();

  const { grid, max } = useMemo(() => {
    const byDate = new Map(activity.map((r) => [r.date, r]));
    const maxXp = activity.reduce((m, r) => Math.max(m, r.xp_earned), 0);

    // Build grid left-to-right by week, top-to-bottom by day-of-week.
    // Anchor on today, then walk back 91 days. We want the rightmost column
    // to contain today. Compute the Monday that starts the earliest week.
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const totalDays = WEEKS * 7;
    const start = new Date(end);
    start.setDate(end.getDate() - (totalDays - 1));
    // Snap start to the Monday of its week so rows align.
    const startDow = (start.getDay() + 6) % 7; // 0=Mon
    start.setDate(start.getDate() - startDow);

    const cells: Array<{ date: string; xp: number; inRange: boolean }[]> = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: Array<{ date: string; xp: number; inRange: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + w * 7 + d);
        const iso = dt.toISOString().slice(0, 10);
        const row = byDate.get(iso);
        col.push({
          date: iso,
          xp: row?.xp_earned ?? 0,
          inRange: dt <= end && dt >= new Date(end.getTime() - (totalDays - 1) * 86_400_000),
        });
      }
      cells.push(col);
    }

    return { grid: cells, max: maxXp };
  }, [activity]);

  function bucket(xp: number): 0 | 1 | 2 | 3 | 4 {
    if (xp === 0) return 0;
    const t = max || 1;
    const r = xp / t;
    if (r < 0.25) return 1;
    if (r < 0.5) return 2;
    if (r < 0.75) return 3;
    return 4;
  }

  const bucketBg: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: theme.colors.surface,
    1: mix(theme.colors.accent, theme.colors.bg, 0.25),
    2: mix(theme.colors.accent, theme.colors.bg, 0.5),
    3: mix(theme.colors.accent, theme.colors.bg, 0.75),
    4: theme.colors.accent,
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: "row", gap: GAP }}>
        {grid.map((col, ci) => (
          <View key={ci} style={{ gap: GAP }}>
            {col.map((cell, ri) => {
              const b = bucket(cell.xp);
              return (
                <View
                  key={ri}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 3,
                    backgroundColor: cell.inRange ? bucketBg[b] : "transparent",
                    borderWidth: cell.inRange && b === 0 ? 1 : 0,
                    borderColor: theme.colors.border,
                    opacity: cell.inRange ? 1 : 0.2,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text variant="caption" color="tertiary">
          Less
        </Text>
        {([0, 1, 2, 3, 4] as const).map((b) => (
          <View
            key={b}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 3,
              backgroundColor: bucketBg[b],
              borderWidth: b === 0 ? 1 : 0,
              borderColor: theme.colors.border,
            }}
          />
        ))}
        <Text variant="caption" color="tertiary">
          More
        </Text>
      </View>
    </View>
  );
}

/**
 * Naive hex-color blend; enough for surfaces with fully-opaque hex inputs.
 * Returns `mix * foreground + (1 - mix) * background`.
 */
function mix(fg: string, bg: string, ratio: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return fg;
  const r = Math.round(f.r * ratio + b.r * (1 - ratio));
  const g = Math.round(f.g * ratio + b.g * (1 - ratio));
  const bl = Math.round(f.b * ratio + b.b * (1 - ratio));
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
