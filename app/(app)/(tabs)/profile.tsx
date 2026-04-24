import { useState } from "react";
import { ScrollView, View } from "react-native";

import { deleteAccount, signOut } from "@/api";
import { ThemePicker } from "@/components/ThemePicker";
import {
  Button,
  Card,
  Modal,
  Screen,
  Text,
  useToast,
} from "@/components/ui";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function Profile() {
  const theme = useTheme();
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
    if (!res.ok) toast.info(res.error);
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
            Account
          </Text>
          <Text variant="h1">Profile</Text>
        </View>

        <Card>
          <Text variant="caption" color="tertiary">
            Signed in as
          </Text>
          <View style={{ height: 4 }} />
          <Text variant="bodyStrong">{session?.user.email ?? "—"}</Text>
          <View style={{ height: theme.spacing.sm }} />
          <Text variant="small" color="secondary">
            User ID: {session?.user.id.slice(0, 8) ?? "—"}…
          </Text>
          <Text variant="small" color="secondary">
            Onboarding: {profile?.onboarding_completed ? "done" : "not yet"}
          </Text>
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" color="tertiary">
              Appearance
            </Text>
            <Text variant="h3">Theme</Text>
            <Text variant="small" color="secondary">
              System follows your device. Pick a specific one to stay put.
            </Text>
          </View>
          <ThemePicker />
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Sign out"
            variant="secondary"
            fullWidth
            onPress={handleSignOut}
            loading={busy}
          />
          <Button
            label="Delete account"
            variant="danger"
            fullWidth
            onPress={() => setConfirmingDelete(true)}
          />
        </View>
      </ScrollView>

      <Modal
        visible={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete your account?"
      >
        <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          This permanently removes your account across MandarinAI and ChineseLens.
          This can't be undone.
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Yes, delete"
            variant="danger"
            fullWidth
            loading={busy}
            onPress={handleDelete}
          />
          <Button
            label="Cancel"
            variant="ghost"
            fullWidth
            onPress={() => setConfirmingDelete(false)}
          />
        </View>
      </Modal>
    </Screen>
  );
}
