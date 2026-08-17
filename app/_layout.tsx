import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import {
  NotoSerifSC_700Bold,
  NotoSerifSC_900Black,
} from "@expo-google-fonts/noto-serif-sc";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandLoader, Button, Text, ToastProvider } from "@/components/ui";
import { I18nProvider, useT } from "@/i18n/i18n";
import { configurePlaybackMode } from "@/lib/audioMode";
import { syncDailyReminder } from "@/lib/reminders";
import { initRevenueCat } from "@/lib/revenuecat";
import { applyScrollDefaults } from "@/lib/scrollDefaults";
import { useUserStore } from "@/stores/userStore";
import { ThemeProvider, useTheme } from "@/theme";

// Hide all native scroll indicators app-wide. Runs once at module load so
// every ScrollView / FlatList rendered below picks up the new default.
applyScrollDefaults();

export default function RootLayout() {
  // Load the brand fonts before anything renders. The design uses Inter for
  // UI, Noto Serif SC for the big hanzi shown on detail / flashcard surfaces,
  // and JetBrains Mono for pinyin and numbers. RN gracefully falls back to
  // system fonts while the assets are loading on first launch.
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_500Medium,
    NotoSerifSC_700Bold,
    NotoSerifSC_900Black,
  });

  useEffect(() => {
    void configurePlaybackMode();
    void initRevenueCat();
  }, []);

  // Render-block while fonts load on the very first launch. Subsequent
  // launches resolve `fontsLoaded` synchronously from the cached fonts.
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <I18nProvider>
            <ThemeProvider>
              <ToastProvider>
                <AuthGate>
                  <Stack
                    screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
                  />
                </AuthGate>
              </ToastProvider>
            </ThemeProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
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
  const profileError = useUserStore((s) => s.profileError);
  const bootstrap = useUserStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Keep the daily study reminder in sync with the profile settings —
  // scheduling is idempotent (cancel + re-add), so re-running is cheap.
  useEffect(() => {
    void syncDailyReminder(profile);
  }, [
    profile?.notification_enabled,
    profile?.notification_time,
    profile?.native_language,
  ]);

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
    return <BrandLoader />;
  }

  // Signed in but the profile fetch failed (offline / backend unreachable).
  // Without this branch the effect above never navigates and the user is
  // stuck on the splash spinner forever.
  if (session && !profile && profileError) {
    return <ConnectionError />;
  }

  // theme is still needed for the rest of the tree to consume — referenced
  // by useTheme() elsewhere. We just don't render anything theme-bound here
  // anymore now that BrandLoader pulls its own theme.
  void theme;
  return <>{children}</>;
}

/** Full-screen offline state with a retry button, shown by AuthGate. */
function ConnectionError() {
  const theme = useTheme();
  const t = useT();
  const retryProfile = useUserStore((s) => s.retryProfile);
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    await retryProfile();
    setRetrying(false);
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing["2xl"],
        gap: theme.spacing.lg,
        backgroundColor: theme.colors.bg,
      }}
    >
      <Text variant="display">📵</Text>
      <Text variant="h2" style={{ textAlign: "center" }}>
        {t.common.error}
      </Text>
      <Text variant="body" color="secondary" style={{ textAlign: "center" }}>
        {t.common.connectionError}
      </Text>
      <Button label={t.common.retry} loading={retrying} onPress={retry} />
    </View>
  );
}
