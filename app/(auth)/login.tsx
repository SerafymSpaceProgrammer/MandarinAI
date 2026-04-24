import { router } from "expo-router";
import { useState } from "react";
import { Pressable as RNPressable, ScrollView, View } from "react-native";

import { signInWithPassword, signUpWithPassword } from "@/api";
import { Button, Input, Screen, Text, useToast } from "@/components/ui";
import { useTheme } from "@/theme";

type Mode = "signin" | "signup";

export default function Login() {
  const theme = useTheme();
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
      toast.success(mode === "signup" ? "Account created" : "Welcome back");
      // Routing is handled by the root layout once the session appears.
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
          <Text variant="h1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </Text>
          <Text variant="body" color="secondary">
            {mode === "signin"
              ? "Sign in to sync your vocabulary from ChineseLens."
              : "Same account works in the ChineseLens extension."}
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
                <Text
                  variant="smallStrong"
                  color={active ? "primary" : "tertiary"}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </Text>
              </RNPressable>
            );
          })}
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Input
            label="Email"
            variant="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoFocus
          />
          <Input
            label="Password"
            variant="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            helper={
              mode === "signup"
                ? "At least 6 characters."
                : undefined
            }
            error={error ?? undefined}
          />
        </View>

        <Button
          label={mode === "signin" ? "Sign in" : "Create account"}
          fullWidth
          loading={submitting}
          disabled={!isValid}
          onPress={submit}
        />

        <RNPressable onPress={() => router.back()} style={{ alignSelf: "center" }}>
          <Text variant="small" color="secondary">
            ← Back
          </Text>
        </RNPressable>
      </ScrollView>
    </Screen>
  );
}
