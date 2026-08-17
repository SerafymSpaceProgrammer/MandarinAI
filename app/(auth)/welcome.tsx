import { router } from "expo-router";
import { View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { useLang, useT } from "@/i18n/i18n";
import { openLegal } from "@/lib/legal";
import { useTheme } from "@/theme";

export default function Welcome() {
  const theme = useTheme();
  const t = useT();
  const lang = useLang();

  return (
    <Screen padded edges={["top", "bottom", "left", "right"]}>
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
          {/* The sentence above references the Terms and Privacy Policy —
              App Review expects them to actually be reachable from here. */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: theme.spacing.xl,
            }}
          >
            <Text
              variant="small"
              style={{ color: theme.colors.accent, textDecorationLine: "underline" }}
              onPress={() => openLegal("terms", lang)}
            >
              {t.profile.termsOfUse}
            </Text>
            <Text
              variant="small"
              style={{ color: theme.colors.accent, textDecorationLine: "underline" }}
              onPress={() => openLegal("privacy", lang)}
            >
              {t.profile.privacyPolicy}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}
