import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { Card, Screen, Text } from "@/components/ui";
import { SCENARIOS } from "@/features/speaking/scenarios";
import { useTheme } from "@/theme";

export default function ScenarioPicker() {
  const theme = useTheme();

  return (
    <Screen>
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Back">
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            Speaking
          </Text>
          <Text variant="h3">Pick a scenario</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          paddingBottom: theme.spacing["5xl"],
        }}
      >
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.accentMuted,
            gap: 2,
          }}
        >
          <Text variant="caption" color="accent">
            How it works
          </Text>
          <Text variant="small">
            Walk through a short dialogue. When it's your turn, tap 🎤 and read the line aloud —
            Whisper will score your pronunciation and give instant feedback.
          </Text>
        </View>

        {SCENARIOS.map((s) => (
          <Card
            key={s.id}
            onPress={() => router.push(`/(app)/practice/session?id=${s.id}`)}
            accessibilityLabel={s.title}
            bordered
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.lg,
            }}
          >
            <Text style={{ fontSize: 36, lineHeight: 40 }}>{s.emoji}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{s.title}</Text>
              <Text variant="small" color="secondary" numberOfLines={2}>
                {s.blurb}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                <Badge text={`HSK ${s.hskLevel}`} tone="accent" />
                <Badge text={`${s.minutes} min`} tone="neutral" />
                <Badge text={`${s.turns.filter((t) => t.speaker === "you").length} turns`} tone="neutral" />
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Badge({ text, tone }: { text: string; tone: "accent" | "neutral" }) {
  const theme = useTheme();
  const bg = tone === "accent" ? theme.colors.accentMuted : theme.colors.surfaceHover;
  const color: "accent" | "tertiary" = tone === "accent" ? "accent" : "tertiary";
  return (
    <View
      style={{
        paddingVertical: 1,
        paddingHorizontal: 8,
        borderRadius: theme.radii.full,
        backgroundColor: bg,
      }}
    >
      <Text variant="caption" color={color}>
        {text}
      </Text>
    </View>
  );
}
