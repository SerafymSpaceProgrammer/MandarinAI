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
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BrandLoader, ToastProvider } from "@/components/ui";
import { I18nProvider } from "@/i18n/i18n";
import { configurePlaybackMode } from "@/lib/audioMode";
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
    return <BrandLoader />;
  }

  // theme is still needed for the rest of the tree to consume — referenced
  // by useTheme() elsewhere. We just don't render anything theme-bound here
  // anymore now that BrandLoader pulls its own theme.
  void theme;
  return <>{children}</>;
}
