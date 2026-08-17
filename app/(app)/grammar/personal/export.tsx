import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ArrowLeft, Check, Copy } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text, useToast } from "@/components/ui";
import {
  exportToJson,
  useHydratedPersonalDeck,
} from "@/features/grammar/personal";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

export default function ExportPersonal() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const { hydrated, constructions } = useHydratedPersonalDeck();
  const [copied, setCopied] = useState(false);

  const json = useMemo(
    () => (hydrated ? exportToJson(constructions) : ""),
    [hydrated, constructions],
  );
  const totalPhrases = constructions.reduce((s, c) => s + c.patterns.length, 0);

  async function handleCopy() {
    if (!json) return;
    try {
      await Clipboard.setStringAsync(json);
      setCopied(true);
      toast.success(t.personalGrammar.copiedToast);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(t.personalGrammar.copyFailed);
    }
  }

  return (
    <Screen padded>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.personalGrammar.eyebrow}
          </Text>
          <Text variant="h3">{t.personalGrammar.exportTitle}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
      >
        {!hydrated ? null : constructions.length === 0 ? (
          <Card padding="lg" bordered>
            <Text variant="bodyStrong">{t.personalGrammar.nothingToExport}</Text>
            <Text variant="small" color="secondary">
              {t.personalGrammar.nothingToExportBody}
            </Text>
          </Card>
        ) : (
          <>
            <Text variant="small" color="secondary">
              {t.personalGrammar.exportIntro}
            </Text>

            <Card padding="md" bordered>
              <Text variant="caption" color="tertiary" style={{ marginBottom: 4 }}>
                {t.personalGrammar.statsLabel}
              </Text>
              <Text variant="small">
                {fmt(t.personalGrammar.statsBody, { c: constructions.length, p: totalPhrases })}
              </Text>
            </Card>

            <Button
              label={copied ? t.personalGrammar.copied : t.personalGrammar.copyToClipboard}
              variant="primary"
              onPress={handleCopy}
              leftIcon={
                copied ? (
                  <Check color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
                ) : (
                  <Copy color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
                )
              }
              fullWidth
            />

            <Card padding="md" bordered>
              <Text
                selectable
                style={{
                  fontFamily: theme.fonts.latin,
                  fontSize: 12,
                  lineHeight: 18,
                  color: theme.colors.textSecondary,
                }}
                chinese
              >
                {json}
              </Text>
            </Card>

            <Text variant="caption" color="tertiary" style={{ marginTop: theme.spacing.md }}>
              {t.personalGrammar.whatIncludedLabel}
            </Text>
            <Text variant="small" color="secondary">
              {t.personalGrammar.whatIncludedBody}
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
