import { router } from "expo-router";
import { useState } from "react";
import { Pressable as RNPressable, ScrollView, View } from "react-native";

import { signInWithPassword, signUpWithPassword } from "@/api";
import { Button, Input, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/theme";

type Mode = "signin" | "signup";

export default function Login() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    email.trim().length > 3 && email.includes("@") && password.length >= 6;

  async function submit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    const fn = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const res = await fn(email, password);

    setSubmitting(false);

    if (res.ok) {
      toast.success(mode === "signup" ? t.auth.toastAccountCreated : t.auth.toastWelcomeBack);
    } else {
      setError(res.error);
    }
  }

  return (
    <Screen padded>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingVertical: theme.spacing["2xl"],
          gap: theme.spacing["2xl"],
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h1">{mode === "signin" ? t.auth.signInTitle : t.auth.signUpTitle}</Text>
          <Text variant="body" color="secondary">
            {mode === "signin" ? t.auth.signInSubtitle : t.auth.signUpSubtitle}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: theme.spacing.xs,
            backgroundColor: theme.colors.surface,
            padding: 4,
            borderRadius: theme.radii.md,
          }}
        >
          {(["signin", "signup"] as const).map((m) => {
            const active = mode === m;
            return (
              <RNPressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: theme.radii.sm,
                  backgroundColor: active ? theme.colors.bg : "transparent",
                }}
              >
                <Text variant="smallStrong" color={active ? "primary" : "tertiary"}>
                  {m === "signin" ? t.auth.tabSignIn : t.auth.tabSignUp}
                </Text>
              </RNPressable>
            );
          })}
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Input
            label={t.auth.email}
            variant="email"
            value={email}
            onChangeText={setEmail}
            placeholder={t.auth.emailPlaceholder}
            autoFocus
          />
          <Input
            label={t.auth.password}
            variant="password"
            value={password}
            onChangeText={setPassword}
            placeholder={t.auth.passwordPlaceholder}
            helper={mode === "signup" ? t.auth.passwordHint : undefined}
            error={error ?? undefined}
          />
        </View>

        <Button
          label={mode === "signin" ? t.auth.tabSignIn : t.auth.tabSignUp}
          fullWidth
          loading={submitting}
          disabled={!isValid}
          onPress={submit}
        />

        <RNPressable onPress={() => router.back()} style={{ alignSelf: "center" }}>
          <Text variant="small" color="secondary">
            {t.auth.backArrow}
          </Text>
        </RNPressable>
      </ScrollView>
    </Screen>
  );
}
