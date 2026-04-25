import { router } from "expo-router";
import { Headphones, Mic, MicVocal, PencilLine } from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/theme";

type Mode = {
  title: string;
  hint: string;
  Icon: React.ComponentType<LucideProps>;
  onPress: () => void;
  disabled?: boolean;
};

export default function Practice() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();

  const modes: Mode[] = [
    {
      title: t.practiceTab.speaking,
      hint: t.practiceTab.speakingHint,
      Icon: MicVocal,
      onPress: () => router.push("/(app)/practice/scenarios"),
    },
    {
      title: t.practiceTab.freeForm,
      hint: t.practiceTab.freeFormHint,
      Icon: Mic,
      disabled: true,
      onPress: () => toast.info(t.practiceTab.freeFormSoon),
    },
    {
      title: t.practiceTab.listening,
      hint: t.practiceTab.listeningHint,
      Icon: Headphones,
      disabled: true,
      onPress: () => toast.info(t.practiceTab.listeningSoon),
    },
    {
      title: t.practiceTab.writing,
      hint: t.practiceTab.writingHint,
      Icon: PencilLine,
      disabled: true,
      onPress: () => toast.info(t.practiceTab.writingSoon),
    },
  ];

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: theme.spacing["2xl"],
          gap: theme.spacing.xl,
          paddingBottom: theme.spacing["5xl"],
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            {t.practiceTab.section}
          </Text>
          <Text variant="h1">{t.practiceTab.title}</Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {modes.map((m) => (
            <Card
              key={m.title}
              onPress={m.onPress}
              accessibilityLabel={m.title}
              bordered
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.lg,
                opacity: m.disabled ? 0.55 : 1,
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
                <m.Icon color={theme.colors.accent} size={26} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{m.title}</Text>
                <Text variant="small" color="secondary">
                  {m.hint}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
