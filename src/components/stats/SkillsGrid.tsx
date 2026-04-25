import { BookOpen, Dumbbell, MicVocal, Type } from "lucide-react-native";
import { View } from "react-native";

import { Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import type { SkillTotals } from "@/features/stats/useStats";
import { useTheme } from "@/theme";

type Props = {
  totals: SkillTotals;
  /** Labels the window — "last 30 days" etc. */
  subtitle?: string;
};

/**
 * Simple skill rollup — no radar chart (would need a charting lib).
 * 4 tiles with icon + count + hint. Shows activity volume, not absolute
 * mastery. Proper per-skill scoring comes with the AI weakness analysis
 * phase.
 */
export function SkillsGrid({ totals, subtitle }: Props) {
  const theme = useTheme();
  const t = useT();

  const tiles = [
    {
      Icon: BookOpen,
      label: t.stats.skillVocab,
      value: totals.vocab,
      unit: t.stats.skillVocabUnit,
    },
    {
      Icon: Type,
      label: t.stats.skillCharacters,
      value: totals.characters,
      unit: t.stats.skillCharactersUnit,
    },
    {
      Icon: MicVocal,
      label: t.stats.skillSpeaking,
      value: totals.speaking,
      unit: t.stats.skillSpeakingUnit,
    },
    {
      Icon: Dumbbell,
      label: t.stats.skillExercises,
      value: totals.exercises,
      unit: t.stats.skillExercisesUnit,
    },
  ];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {subtitle ? (
        <Text variant="caption" color="tertiary">
          {subtitle}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {tiles.map((tile) => (
          <View
            key={tile.label}
            style={{
              flexBasis: "47%",
              flexGrow: 1,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              gap: 2,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.colors.accentMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <tile.Icon color={theme.colors.accent} size={18} strokeWidth={2} />
            </View>
            <Text variant="h2" style={{ marginTop: 4 }}>
              {tile.value}
            </Text>
            <Text variant="small" color="secondary">
              {tile.label}
            </Text>
            <Text variant="caption" color="tertiary">
              {tile.unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
