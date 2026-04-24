import { router } from "expo-router";
import { View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { useTheme } from "@/theme";

export default function Welcome() {
  const theme = useTheme();

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.md, marginTop: theme.spacing["4xl"] }}>
          <Text variant="display" chinese align="center" style={{ color: theme.colors.accent }}>
            中文
          </Text>
          <Text variant="h1" align="center">
            MandarinAI
          </Text>
          <Text variant="body" color="secondary" align="center">
            Learn Mandarin the modern way — with AI that adapts to you.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Continue with email"
            fullWidth
            onPress={() => router.push("/(auth)/login")}
          />
          <Text variant="small" color="tertiary" align="center" style={{ paddingHorizontal: theme.spacing.lg }}>
            By continuing, you agree to the Terms and Privacy Policy.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
