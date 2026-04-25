import { useState } from "react";
import { ScrollView, View } from "react-native";

import { deleteAccount, signOut } from "@/api";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemePicker } from "@/components/ThemePicker";
import {
  Button,
  Card,
  Modal,
  Screen,
  Text,
  useToast,
} from "@/components/ui";
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
    if (!res.ok) toast.info(t.profile.deleteContact);
  }

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: theme.spacing["2xl"],
          gap: theme.spacing.xl,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            {t.profile.section}
          </Text>
          <Text variant="h1">{t.profile.title}</Text>
        </View>

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

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" color="tertiary">
              {t.profile.appearanceSection}
            </Text>
            <Text variant="h3">{t.profile.themeTitle}</Text>
            <Text variant="small" color="secondary">
              {t.profile.themeHint}
            </Text>
          </View>
          <ThemePicker />
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" color="tertiary">
              {t.profile.languageSection}
            </Text>
            <Text variant="h3">{t.profile.languageTitle}</Text>
            <Text variant="small" color="secondary">
              {t.profile.languageHint}
            </Text>
          </View>
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
