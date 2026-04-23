import { useState } from "react";
import { ScrollView, View } from "react-native";

import {
  Button,
  Card,
  Input,
  Modal,
  Pressable,
  Screen,
  Skeleton,
  Text,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme";

export default function DevIndex() {
  const theme = useTheme();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing["2xl"],
          paddingBottom: theme.spacing["5xl"],
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            Phase 0 · Dev Playground
          </Text>
          <Text variant="h1">MandarinAI</Text>
          <Text variant="body" color="secondary">
            Scaffold sanity check for theme + primitives.
          </Text>
        </View>

        <Section title="Typography">
          <Text variant="display">Aa 你好</Text>
          <Text variant="h2" chinese>汉字</Text>
          <Text variant="pinyin" tone={1}>mā</Text>
          <Text variant="pinyin" tone={2}>má</Text>
          <Text variant="pinyin" tone={3}>mǎ</Text>
          <Text variant="pinyin" tone={4}>mà</Text>
          <Text variant="pinyin" tone={0}>ma</Text>
          <Text variant="body">Body text — {theme.scheme} mode.</Text>
          <Text variant="small" color="secondary">Secondary small.</Text>
        </Section>

        <Section title="Buttons">
          <Button label="Primary" onPress={() => toast.info("Primary pressed")} fullWidth />
          <Button label="Secondary" variant="secondary" fullWidth onPress={() => toast.info("Secondary")} />
          <Button label="Ghost" variant="ghost" fullWidth />
          <Button label="Danger" variant="danger" fullWidth />
          <Button label="Loading" loading fullWidth />
          <Button label="Disabled" disabled fullWidth />
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <Button label="sm" size="sm" variant="secondary" />
            <Button label="md" size="md" variant="secondary" />
            <Button label="lg" size="lg" variant="secondary" />
          </View>
        </Section>

        <Section title="Inputs">
          <Input label="Email" variant="email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <Input label="Password" variant="password" placeholder="••••••••" />
          <Input label="With error" error="This field is required" placeholder="Type here" />
          <Input label="With helper" helper="We'll never share this." placeholder="Your name" />
        </Section>

        <Section title="Card + Pressable">
          <Card onPress={() => toast.success("Card tapped")} accessibilityLabel="Demo card">
            <Text variant="bodyStrong">Pressable card</Text>
            <Text variant="small" color="secondary">Has haptic + scale on press.</Text>
          </Card>
          <Card elevation="md" bordered>
            <Text variant="bodyStrong">Static card</Text>
            <Text variant="small" color="secondary">Elevation + border.</Text>
          </Card>
          <Pressable
            haptic="medium"
            onPress={() => toast.warning("Plain pressable")}
            style={{
              padding: theme.spacing.lg,
              backgroundColor: theme.colors.accentMuted,
              borderRadius: theme.radii.md,
            }}
          >
            <Text color="accent" variant="bodyStrong" align="center">
              Tap me
            </Text>
          </Pressable>
        </Section>

        <Section title="Skeleton">
          <Skeleton height={24} width="60%" />
          <Skeleton height={16} />
          <Skeleton height={16} width="80%" />
        </Section>

        <Section title="Modal & Toast">
          <Button label="Open bottom sheet" variant="secondary" onPress={() => setModalOpen(true)} fullWidth />
          <Button label="Toast: success" variant="ghost" onPress={() => toast.success("It worked.")} fullWidth />
          <Button label="Toast: error" variant="ghost" onPress={() => toast.error("Something broke.")} fullWidth />
        </Section>
      </ScrollView>

      <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title="Bottom sheet">
        <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Tap the backdrop or the close button to dismiss.
        </Text>
        <Button label="Close" fullWidth onPress={() => setModalOpen(false)} />
      </Modal>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="caption" color="tertiary">{title}</Text>
      <View style={{ gap: theme.spacing.md }}>{children}</View>
    </View>
  );
}
