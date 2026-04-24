import { useState } from "react";
import { Pressable, View } from "react-native";

import { updateProfile } from "@/api";
import { Text, useToast } from "@/components/ui";
import { useUserStore } from "@/stores/userStore";
import type { AppThemeId } from "@/types";
import { APP_THEMES, useTheme } from "@/theme";

type PickOption = {
  id: AppThemeId;
  name: string;
  emoji: string;
  /** Colors to preview in the swatch. null = use the currently-active theme (for "System"). */
  preview: { bg: string; textPrimary: string; accent: string; surface: string } | null;
};

export function ThemePicker() {
  const theme = useTheme();
  const toast = useToast();
  const { session, profile, setProfile } = useUserStore();
  const [pending, setPending] = useState<AppThemeId | null>(null);

  const selected: AppThemeId = profile?.app_theme ?? "system";

  const options: PickOption[] = [
    { id: "system", name: "System", emoji: "⚙️", preview: null },
    ...APP_THEMES.map((t) => ({
      id: t.id as AppThemeId,
      name: t.name,
      emoji: t.emoji,
      preview: {
        bg: t.colors.bg,
        textPrimary: t.colors.textPrimary,
        accent: t.colors.accent,
        surface: t.colors.surface,
      },
    })),
  ];

  async function pick(id: AppThemeId) {
    if (!session || pending) return;
    if (id === selected) return;

    // Optimistic update — flip the theme immediately, revert on error.
    const prevProfile = profile;
    if (profile) setProfile({ ...profile, app_theme: id });
    setPending(id);

    const updated = await updateProfile(session.user.id, { app_theme: id });
    setPending(null);

    if (!updated) {
      if (prevProfile) setProfile(prevProfile);
      toast.error("Couldn't save theme. Please try again.");
      return;
    }
    setProfile(updated);
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
      {options.map((o) => {
        const active = o.id === selected;
        const previewBg = o.preview?.bg ?? theme.colors.bg;
        const previewAccent = o.preview?.accent ?? theme.colors.accent;
        const previewText = o.preview?.textPrimary ?? theme.colors.textPrimary;
        const previewSurface = o.preview?.surface ?? theme.colors.surface;

        return (
          <Pressable
            key={o.id}
            onPress={() => pick(o.id)}
            accessibilityLabel={o.name}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            disabled={pending !== null}
            style={{
              flexBasis: "47%",
              flexGrow: 1,
              borderRadius: theme.radii.md,
              borderWidth: active ? 2 : 1,
              borderColor: active ? theme.colors.accent : theme.colors.border,
              overflow: "hidden",
              opacity: pending && pending !== o.id ? 0.6 : 1,
            }}
          >
            <View
              style={{
                backgroundColor: previewBg,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
                minHeight: 96,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 20, lineHeight: 24 }}>{o.emoji}</Text>
                {active ? (
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: previewAccent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700", lineHeight: 14 }}>
                      ✓
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                chinese
                style={{ color: previewText, fontSize: 22, fontWeight: "700", lineHeight: 26 }}
              >
                你好
              </Text>

              <View style={{ flexDirection: "row", gap: 4 }}>
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: previewAccent }} />
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: previewSurface }} />
              </View>
            </View>

            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                backgroundColor: theme.colors.surface,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              <Text variant="smallStrong">{o.name}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
