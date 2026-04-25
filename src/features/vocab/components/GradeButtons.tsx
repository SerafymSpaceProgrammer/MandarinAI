import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { previewIntervals, type ReviewableCard, type ReviewGrade } from "@/features/vocab/srs";
import { useTheme } from "@/theme";

type Props = {
  card: ReviewableCard;
  onGrade: (grade: ReviewGrade) => void;
  disabled?: boolean;
};

const HAPTIC_FOR_GRADE: Record<ReviewGrade, Haptics.ImpactFeedbackStyle> = {
  again: Haptics.ImpactFeedbackStyle.Heavy,
  good: Haptics.ImpactFeedbackStyle.Medium,
  easy: Haptics.ImpactFeedbackStyle.Light,
};

export function GradeButtons({ card, onGrade, disabled }: Props) {
  const theme = useTheme();
  const t = useT();
  const intervals = previewIntervals(card);

  const GRADES: { grade: ReviewGrade; label: string; color: "danger" | "warning" | "success" }[] = [
    { grade: "again", label: t.vocab.review.gradeAgain, color: "danger" },
    { grade: "good",  label: t.vocab.review.gradeGood,  color: "warning" },
    { grade: "easy",  label: t.vocab.review.gradeEasy,  color: "success" },
  ];

  return (
    <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
      {GRADES.map(({ grade, label, color }) => (
        <Pressable
          key={grade}
          disabled={disabled}
          onPress={() => {
            Haptics.impactAsync(HAPTIC_FOR_GRADE[grade]).catch(() => {});
            onGrade(grade);
          }}
          style={{
            flex: 1,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors[color],
            opacity: disabled ? 0.4 : 1,
            alignItems: "center",
            gap: 2,
          }}
          accessibilityLabel={`${label}, next review in ${intervals[grade]} days`}
          accessibilityRole="button"
        >
          <Text variant="bodyStrong" color="onAccent">
            {label}
          </Text>
          <Text variant="small" color="onAccent" style={{ opacity: 0.9 }}>
            {formatInterval(intervals[grade])}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatInterval(days: number): string {
  if (days < 1) return "<1d";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.round(days / 365);
  return `${years}y`;
}
