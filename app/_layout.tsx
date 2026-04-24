import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/ui";
import { useUserStore } from "@/stores/userStore";
import { ThemeProvider, useTheme } from "@/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthGate>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
              />
            </AuthGate>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * AuthGate boots Supabase, then redirects the user to the right group:
 * - (auth)      when there is no session
 * - (onboarding) when signed in but profile.onboarding_completed is false
 * - (app)       when fully onboarded
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const initializing = useUserStore((s) => s.initializing);
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const bootstrap = useUserStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (initializing) return;

    const group = segments[0]; // "(auth)" | "(onboarding)" | "(app)" | undefined

    if (!session) {
      if (group !== "(auth)") router.replace("/(auth)/welcome");
      return;
    }

    // Signed in but profile not loaded yet — wait.
    if (!profile) return;

    if (!profile.onboarding_completed) {
      if (group !== "(onboarding)") router.replace("/(onboarding)");
      return;
    }

    if (group !== "(app)") router.replace("/(app)");
  }, [initializing, session, profile, segments, pathname, router]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}
