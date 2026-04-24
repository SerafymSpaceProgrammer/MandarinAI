import { router } from "expo-router";
import { BookOpen, Compass, LibraryBig, Plus, Type } from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text, useToast } from "@/components/ui";
import { useTheme } from "@/theme";

type Entry = {
  title: string;
  hint: string;
  Icon: React.ComponentType<LucideProps>;
  onPress: () => void;
  disabled?: boolean;
};

export default function Learn() {
  const theme = useTheme();
  const toast = useToast();

  const entries: Entry[] = [
    {
      title: "Vocabulary review",
      hint: "SRS flashcards from your saved deck",
      Icon: BookOpen,
      onPress: () => router.push("/(app)/vocab/review"),
    },
    {
      title: "Browse deck",
      hint: "Search, filter, and manage saved words",
      Icon: LibraryBig,
      onPress: () => router.push("/(app)/vocab/browse"),
    },
    {
      title: "Add a word",
      hint: "Manual entry with auto-pinyin",
      Icon: Plus,
      onPress: () => router.push("/(app)/vocab/add"),
    },
    {
      title: "Characters",
      hint: "5-step introduction + mnemonics · HSK 1",
      Icon: Type,
      onPress: () => router.push("/(app)/character"),
    },
    {
      title: "Grammar patterns",
      hint: "Coming in Phase 7",
      Icon: Compass,
      disabled: true,
      onPress: () => toast.info("Grammar patterns arrive with the exercises hub"),
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
            Learn
          </Text>
          <Text variant="h1">Pick a mode</Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {entries.map((e) => (
            <Card
              key={e.title}
              onPress={e.disabled ? e.onPress : e.onPress}
              accessibilityLabel={e.title}
              bordered
              style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.lg, opacity: e.disabled ? 0.55 : 1 }}
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
                <e.Icon color={theme.colors.accent} size={26} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{e.title}</Text>
                <Text variant="small" color="secondary">
                  {e.hint}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
