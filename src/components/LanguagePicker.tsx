import { useState } from "react";
import { Pressable, View } from "react-native";

import { updateProfile } from "@/api";
import { Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useUserStore } from "@/stores/userStore";
import type { NativeLanguage } from "@/types";
import { useTheme } from "@/theme";

// Language names are intentionally written in each language's own script —
// users find their tongue regardless of current UI language.
const OPTIONS: Array<{ code: NativeLanguage; flag: string; native: string }> = [
  { code: "en", flag: "🇺🇸", native: "English" },
  { code: "es", flag: "🇪🇸", native: "Español" },
  { code: "pt", flag: "🇵🇹", native: "Português" },
  { code: "ru", flag: "🇷🇺", native: "Русский" },
  { code: "zh", flag: "🇨🇳", native: "中文" },
];

export function LanguagePicker() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const { session, profile, setProfile } = useUserStore();
  const [pending, setPending] = useState<NativeLanguage | null>(null);

  const selected: NativeLanguage = profile?.native_language ?? "en";

  async function pick(lang: NativeLanguage) {
    if (!session || pending) return;
    if (lang === selected) return;

    const prev = profile;
    if (profile) setProfile({ ...profile, native_language: lang });
    setPending(lang);

    const updated = await updateProfile(session.user.id, { native_language: lang });
    setPending(null);

    if (!updated) {
      if (prev) setProfile(prev);
      toast.error(t.common.error);
      return;
    }
    setProfile(updated);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {OPTIONS.map((o) => {
        const active = o.code === selected;
        return (
          <Pressable
            key={o.code}
            onPress={() => pick(o.code)}
            disabled={pending !== null}
            accessibilityLabel={o.native}
            accessibilityState={{ selected: active }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              borderWidth: active ? 2 : 1,
              borderColor: active ? theme.colors.accent : theme.colors.border,
              backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface,
              opacity: pending !== null && pending !== o.code ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 24 }}>{o.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{o.native}</Text>
            </View>
            {active ? (
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: theme.colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>✓</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
