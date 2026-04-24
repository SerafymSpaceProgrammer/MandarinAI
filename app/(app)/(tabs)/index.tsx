import { ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function Home() {
  const theme = useTheme();
  const { session, profile } = useUserStore();

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: theme.spacing["2xl"],
          gap: theme.spacing.xl,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            Phase 1 · Home placeholder
          </Text>
          <Text variant="h1">你好 👋</Text>
          <Text variant="body" color="secondary">
            Signed in as {session?.user.email}
          </Text>
        </View>

        <Card>
          <Text variant="bodyStrong">Profile</Text>
          <View style={{ height: theme.spacing.sm }} />
          <Text variant="small" color="secondary">
            HSK level: {profile?.hsk_level ?? "?"}
          </Text>
          <Text variant="small" color="secondary">
            Native language: {profile?.native_language ?? "?"}
          </Text>
          <Text variant="small" color="secondary">
            Daily goal: {profile?.daily_goal_minutes ?? "?"} min
          </Text>
        </Card>

        <Card>
          <Text variant="bodyStrong">What's next</Text>
          <View style={{ height: theme.spacing.sm }} />
          <Text variant="small" color="secondary">
            Phase 2 — onboarding flow{"\n"}
            Phase 3 — home + daily plan{"\n"}
            Phase 4 — vocabulary trainer (SRS)
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
