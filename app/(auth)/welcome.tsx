import { router } from "expo-router";
import { View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/theme";

export default function Welcome() {
  const theme = useTheme();
  const t = useT();

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.md, marginTop: theme.spacing["4xl"] }}>
          <Text variant="display" chinese align="center" style={{ color: theme.colors.accent }}>
            中文
          </Text>
          <Text variant="h1" align="center">
            {t.auth.welcomeTitle}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {t.auth.welcomeBlurb}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={t.auth.continueWithEmail}
            fullWidth
            onPress={() => router.push("/(auth)/login")}
          />
          <Text variant="small" color="tertiary" align="center" style={{ paddingHorizontal: theme.spacing.lg }}>
            {t.auth.terms}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
