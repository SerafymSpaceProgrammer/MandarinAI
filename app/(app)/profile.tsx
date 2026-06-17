import { router } from "expo-router";
import { Crown, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { deleteAccount, signOut } from "@/api";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemePicker } from "@/components/ThemePicker";
import {
  Button,
  Card,
  Modal,
  Screen,
  ScreenHeader,
  SectionLabel,
  Text,
  useToast,
} from "@/components/ui";
import { isPro } from "@/features/subscription/subscription";
import { fmt } from "@/i18n/strings";
import { useT } from "@/i18n/i18n";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function Profile() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const { session, profile } = useUserStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    await signOut();
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    const res = await deleteAccount();
    setBusy(false);
    setConfirmingDelete(false);
    if (res.ok) {
      // signOut already happened inside deleteAccount; the auth gate will
      // route us out. A short confirmation toast feels right before that.
      toast.success(t.profile.deleteDone);
    } else {
      toast.error(res.error ?? t.profile.deleteContact);
    }
  }

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: theme.spacing["2xl"],
          gap: theme.spacing["2xl"],
          paddingBottom: theme.spacing["6xl"],
        }}
      >
        <ScreenHeader
          eyebrow={t.profile.section}
          title={t.profile.title}
          hanzi="我"
        />

        <Card>
          <Text variant="caption" color="tertiary">
            {t.profile.signedInAs}
          </Text>
          <View style={{ height: 4 }} />
          <Text variant="bodyStrong">{session?.user.email ?? "—"}</Text>
          <View style={{ height: theme.spacing.sm }} />
          <Text variant="small" color="secondary">
            {fmt(t.profile.userId, { id: session?.user.id.slice(0, 8) ?? "—" })}
          </Text>
          <Text variant="small" color="secondary">
            {profile?.onboarding_completed
              ? t.profile.onboardingDone
              : t.profile.onboardingPending}
          </Text>
        </Card>

        <SubscriptionRow profile={profile} t={t} />

        <View style={{ gap: theme.spacing.md }}>
          <SectionLabel
            label={t.profile.themeTitle}
            hint={t.profile.themeHint}
          />
          <ThemePicker />
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <SectionLabel
            label={t.profile.languageTitle}
            hint={t.profile.languageHint}
          />
          <LanguagePicker />
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label={t.profile.signOut}
            variant="secondary"
            fullWidth
            onPress={handleSignOut}
            loading={busy}
          />
          <Button
            label={t.profile.deleteAccount}
            variant="danger"
            fullWidth
            onPress={() => setConfirmingDelete(true)}
          />
        </View>
      </ScrollView>

      <Modal
        visible={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={t.profile.deleteConfirmTitle}
      >
        <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          {t.profile.deleteConfirmBody}
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={t.profile.deleteYes}
            variant="danger"
            fullWidth
            loading={busy}
            onPress={handleDelete}
          />
          <Button
            label={t.common.cancel}
            variant="ghost"
            fullWidth
            onPress={() => setConfirmingDelete(false)}
          />
        </View>
      </Modal>
    </Screen>
  );
}

/**
 * Compact subscription summary on the profile screen. Routes into the full
 * subscription screen on tap. Reads `profile.tier` straight from the shared
 * `profiles` row — the LemonSqueezy webhook keeps that column in sync so
 * we never have to talk to LemonSqueezy from the device.
 */
function SubscriptionRow({
  profile,
  t,
}: {
  profile: ReturnType<typeof useUserStore.getState>["profile"];
  t: ReturnType<typeof useT>;
}) {
  const theme = useTheme();
  const pro = isPro(profile);
  const tierLabel =
    profile?.tier === "lifetime"
      ? t.subscription.tierLifetime
      : pro
        ? t.subscription.tierPro
        : t.subscription.tierFree;
  const tone = pro ? theme.colors.accent : theme.colors.textSecondary;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionLabel
        label={t.subscription.title}
        hint={
          pro ? t.subscription.proHintShort : t.subscription.freeHintShort
        }
      />
      <Pressable
        onPress={() => router.push("/(app)/subscription")}
        accessibilityRole="button"
        accessibilityLabel={t.subscription.openTitle}
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: pro ? theme.colors.accent : theme.colors.border,
          overflow: "hidden",
        }}
      >
        <View style={{ width: 4, backgroundColor: theme.colors.accent }} />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radii.sm,
              backgroundColor: theme.colors.accentMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {pro ? (
              <Crown color={theme.colors.accent} size={22} strokeWidth={2.2} />
            ) : (
              <Sparkles color={theme.colors.accent} size={22} strokeWidth={2.2} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" style={{ color: tone }}>
              {tierLabel}
            </Text>
            <Text variant="small" color="secondary">
              {pro ? t.subscription.proRowSub : t.subscription.freeRowSub}
            </Text>
          </View>
          <Text variant="small" color="accent">
            {pro ? t.subscription.manageShort : t.subscription.upgradeShort} ›
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
