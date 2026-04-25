import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { Card, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { SCENARIOS } from "@/features/speaking/scenarios";
import { useTheme } from "@/theme";

export default function ScenarioPicker() {
  const theme = useTheme();
  const t = useT();

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
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.speaking.title}
          </Text>
          <Text variant="h3">{t.speaking.pickScenario}</Text>
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
            {t.speaking.howItWorks}
          </Text>
          <Text variant="small">
            {t.speaking.howItWorksBody}
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
                <Badge text={fmt(t.speaking.badgeHsk, { n: s.hskLevel })} tone="accent" />
                <Badge text={fmt(t.speaking.badgeMinutes, { n: s.minutes })} tone="neutral" />
                <Badge
                  text={(() => {
                    const turnCount = s.turns.filter((turn) => turn.speaker === "you").length;
                    return fmt(
                      turnCount === 1 ? t.speaking.badgeTurnsOne : t.speaking.badgeTurnsOther,
                      { n: turnCount },
                    );
                  })()}
                  tone="neutral"
                />
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
