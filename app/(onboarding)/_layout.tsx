import { Stack, router, useSegments } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { useTheme } from "@/theme";

/**
 * Ordered list of onboarding steps that count toward the progress bar.
 * `done` is the celebration screen and is intentionally excluded.
 */
const STEPS = ["language", "level", "goal", "time", "notifications"] as const;
type Step = (typeof STEPS)[number];

const SKIPPABLE: ReadonlySet<Step> = new Set(["notifications"]);

export default function OnboardingLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];

  // segments[0] is "(onboarding)", segments[1] is the step name.
  const current = segments[1] as Step | undefined;
  const stepIndex = current ? STEPS.indexOf(current) : -1;
  const showHeader = stepIndex >= 0;

  const progress = stepIndex >= 0 ? (stepIndex + 1) / STEPS.length : 0;
  const canGoBack = stepIndex > 0;
  const canSkip = current != null && SKIPPABLE.has(current);

  const nextStepHref = (): string | null => {
    if (stepIndex < 0) return null;
    const next = STEPS[stepIndex + 1];
    return next ? `/(onboarding)/${next}` : "/(onboarding)/done";
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {showHeader ? (
        <View
          style={{
            paddingTop: insets.top + theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 32,
            }}
          >
            {canGoBack ? (
              <Pressable
                onPress={() => router.back()}
                hitSlop={16}
                accessibilityLabel="Back"
              >
                <Text variant="h3" color="secondary">
                  ←
                </Text>
              </Pressable>
            ) : (
              <View style={{ width: 24 }} />
            )}

            <Text variant="small" color="tertiary">
              {stepIndex + 1} / {STEPS.length}
            </Text>

            {canSkip ? (
              <Pressable
                onPress={() => {
                  const href = nextStepHref();
                  if (href) router.replace(href as never);
                }}
                hitSlop={16}
                accessibilityLabel="Skip"
              >
                <Text variant="small" color="tertiary">
                  Skip
                </Text>
              </Pressable>
            ) : (
              <View style={{ width: 24 }} />
            )}
          </View>

          <View
            style={{
              height: 4,
              backgroundColor: theme.colors.surface,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                backgroundColor: theme.colors.accent,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      ) : null}

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </View>
  );
}
