import { router } from "expo-router";
import { Headphones, Mic, MicVocal, PencilLine } from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text, useToast } from "@/components/ui";
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
  const toast = useToast();

  const modes: Mode[] = [
    {
      title: "Speaking scenarios",
      hint: "Rehearse short dialogues — Whisper scores your pronunciation",
      Icon: MicVocal,
      onPress: () => router.push("/(app)/practice/scenarios"),
    },
    {
      title: "Free-form conversation",
      hint: "Live AI tutor · arrives with Realtime API phase",
      Icon: Mic,
      disabled: true,
      onPress: () => toast.info("Live conversation is a later phase"),
    },
    {
      title: "Listening",
      hint: "Audio snippets + quick comprehension quiz · coming soon",
      Icon: Headphones,
      disabled: true,
      onPress: () => toast.info("Listening practice comes next"),
    },
    {
      title: "Writing",
      hint: "Stroke order drawing · needs Skia canvas",
      Icon: PencilLine,
      disabled: true,
      onPress: () => toast.info("Writing practice arrives with stroke data"),
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
            Practice
          </Text>
          <Text variant="h1">Pick a mode</Text>
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
