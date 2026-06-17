import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type Props = {
  /** Title shown centered in the bar. */
  title: string;
  /** Optional small uppercase label above the title. */
  eyebrow?: string;
  /** Slot for an action on the right (Add, Filter, etc.). */
  rightAction?: ReactNode;
  /** Override the default `router.back()` behavior. Pass `null` to hide. */
  onBack?: (() => void) | null;
  /**
   * Where to navigate when the back button is tapped. We default to
   * Learn rather than the legacy `router.back()` because the parent tab
   * navigator drops previous-tab history when pushing into a hidden
   * sub-screen (so `back()` lands on Home regardless of where the user
   * actually came from). Learn is the natural parent of every library
   * section; callers landing under a different tab can override.
   */
  fallbackHref?: Parameters<typeof router.replace>[0];
};

/**
 * Header for inner pages reached via push navigation (vocab/browse, hsk, the
 * character roadmap, etc.). Replaces the previous one-off "back arrow + title"
 * rows with a single branded component: rounded back chip on a surface
 * background, eyebrow + title block in the middle, optional right action.
 *
 * Visually consistent with `ScreenHeader` but compact — meant to live at the
 * top of a screen that the user navigated *into*, not landed on.
 */
export function PageHeader({
  title,
  eyebrow,
  rightAction,
  onBack,
  fallbackHref = "/(app)/learn",
}: Props) {
  const theme = useTheme();
  const showBack = onBack !== null;

  /**
   * Always navigate to `fallbackHref` instead of `router.back()`. Tabs with
   * hidden sub-routes don't track the previous tab in history — `back()`
   * collapses to the first tab (Home) rather than the actual referrer.
   * Forcing `replace` keeps the user oriented: every library section pops
   * back to Learn by default; deep-links from other tabs can override.
   */
  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    router.replace(fallbackHref);
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
      }}
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft color={theme.colors.textPrimary} size={20} strokeWidth={2.2} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? (
          <Text variant="caption" color="tertiary">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h3" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
}
