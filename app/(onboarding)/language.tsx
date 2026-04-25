import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useOnboardingStore } from "@/stores/onboardingStore";
import type { NativeLanguage } from "@/types";
import { useTheme } from "@/theme";

type Choice = {
  code: NativeLanguage;
  flag: string;
  label: string;
};

const CHOICES: Choice[] = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "pt", flag: "🇵🇹", label: "Português" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
];

export default function LanguageStep() {
  const theme = useTheme();
  const t = useT();
  const selected = useOnboardingStore((s) => s.native_language);
  const setDraft = useOnboardingStore((s) => s.set);

  function pick(code: NativeLanguage) {
    setDraft({ native_language: code });
    router.push("/(onboarding)/level");
  }

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.xl, gap: theme.spacing["2xl"] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">{t.onboarding.language.title}</Text>
          <Text variant="body" color="secondary">
            {t.onboarding.language.hint}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {CHOICES.map((c) => (
            <Card
              key={c.code}
              onPress={() => pick(c.code)}
              accessibilityLabel={c.label}
              bordered={selected === c.code}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.lg,
                borderColor: selected === c.code ? theme.colors.accent : theme.colors.border,
                borderWidth: selected === c.code ? 2 : 1,
              }}
            >
              <Text variant="display" style={{ fontSize: 40, lineHeight: 44 }}>
                {c.flag}
              </Text>
              <Text variant="h3">{c.label}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
