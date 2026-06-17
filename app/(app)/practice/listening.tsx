import { router } from "expo-router";
import { ArrowLeft, Headphones, Play } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import {
  ALL_LEXICAL_LEVELS,
  type LexicalLevel,
} from "@/features/grammar/patterns";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/theme";

export default function ListeningPicker() {
  const theme = useTheme();
  const t = useT();
  const [level, setLevel] = useState<LexicalLevel>(1);

  return (
    <Screen padded>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.listeningDrill.eyebrow}
          </Text>
          <Text variant="h3">{t.listeningDrill.title}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
      >
        <Card padding="lg" bordered>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.md,
              marginBottom: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: theme.colors.accentMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Headphones color={theme.colors.accent} size={26} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t.listeningDrill.introTitle}</Text>
              <Text variant="small" color="secondary">
                {t.listeningDrill.introSubtitle}
              </Text>
            </View>
          </View>
          <Text variant="small" color="secondary">
            {t.listeningDrill.introBody}
          </Text>
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" color="tertiary">
            {t.listeningDrill.lexicalLevelLabel}
          </Text>
          <Text variant="small" color="secondary">
            {t.listeningDrill.lexicalLevelHint}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: theme.spacing.sm,
              marginTop: theme.spacing.xs,
            }}
          >
            {ALL_LEXICAL_LEVELS.map((lvl) => (
              <LevelChip
                key={lvl}
                level={lvl}
                active={lvl === level}
                onPress={() => setLevel(lvl)}
              />
            ))}
          </View>
        </View>

        <Button
          label={t.listeningDrill.start}
          variant="primary"
          onPress={() =>
            router.push(`/(app)/practice/listening-session?level=${level}`)
          }
          leftIcon={<Play color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
          fullWidth
        />

        <Text variant="caption" color="tertiary" style={{ marginTop: theme.spacing.md }}>
          {t.listeningDrill.tipLabel}
        </Text>
        <Text variant="small" color="secondary">
          {t.listeningDrill.tipBody}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function LevelChip({
  level,
  active,
  onPress,
}: {
  level: LexicalLevel;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: 10,
        borderRadius: theme.radii.full,
        backgroundColor: active ? theme.colors.accent : theme.colors.surface,
        borderWidth: 1,
        borderColor: active ? theme.colors.accent : theme.colors.border,
      }}
    >
      <Text variant="bodyStrong" color={active ? "onAccent" : "primary"}>
        HSK {level === 1 ? 1 : `1–${level}`}
      </Text>
    </Pressable>
  );
}
