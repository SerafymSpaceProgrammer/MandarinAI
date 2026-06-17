import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Layers,
  Plus,
  Trash2,
  Upload,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import { useHydratedPersonalDeck } from "@/features/grammar/personal";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

export default function PersonalIndex() {
  const theme = useTheme();
  const t = useT();
  const { hydrated, constructions, removeConstruction } = useHydratedPersonalDeck();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const totalPhrases = constructions.reduce((s, c) => s + c.patterns.length, 0);

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
          <Text variant="h3">{t.personalGrammar.title}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
      >
        {hydrated && constructions.length === 0 ? (
          <View
            style={{
              padding: theme.spacing.xl,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              gap: theme.spacing.sm,
            }}
          >
            <Text variant="bodyStrong">{t.personalGrammar.emptyTitle}</Text>
            <Text variant="small" color="secondary">
              {t.personalGrammar.emptyBody}
            </Text>
          </View>
        ) : (
          <Text variant="small" color="secondary">
            {fmt(
              constructions.length === 1
                ? t.personalGrammar.constructionsCountOne
                : t.personalGrammar.constructionsCountOther,
              { n: constructions.length },
            )}
            {"  ·  "}
            {fmt(
              totalPhrases === 1
                ? t.personalGrammar.phrasesCountOne
                : t.personalGrammar.phrasesCountOther,
              { n: totalPhrases },
            )}
          </Text>
        )}

        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <Button
            label={t.personalGrammar.create}
            variant="primary"
            onPress={() => router.push("/(app)/grammar/personal/new")}
            leftIcon={<Plus color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
            fullWidth
            style={{ flex: 1 }}
          />
          <Button
            label={t.personalGrammar.importJson}
            variant="secondary"
            onPress={() => router.push("/(app)/grammar/personal/import")}
            leftIcon={<Download color={theme.colors.textPrimary} size={18} strokeWidth={2} />}
            fullWidth
            style={{ flex: 1 }}
          />
        </View>
        {constructions.length > 0 ? (
          <Button
            label={t.personalGrammar.exportJson}
            variant="ghost"
            onPress={() => router.push("/(app)/grammar/personal/export")}
            leftIcon={<Upload color={theme.colors.accent} size={18} strokeWidth={2} />}
            fullWidth
          />
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          {constructions.map((c) => (
            <Card
              key={c.id}
              onPress={() => router.push(`/(app)/grammar/personal/${c.id}`)}
              bordered
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.lg,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: theme.colors.accentMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    chinese
                    style={{
                      fontSize: 22,
                      lineHeight: 26,
                      fontWeight: "700",
                      color: theme.colors.accent,
                    }}
                    numberOfLines={1}
                  >
                    {firstHanzi(c.name) || "✎"}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text chinese variant="bodyStrong" numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.ru_name ? (
                    <Text variant="small" color="secondary" numberOfLines={2}>
                      {c.ru_name}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 2,
                    }}
                  >
                    <Layers color={theme.colors.textTertiary} size={14} strokeWidth={2} />
                    <Text variant="caption" color="tertiary">
                      {fmt(
                        c.patterns.length === 1
                          ? t.personalGrammar.phrasesCountOne
                          : t.personalGrammar.phrasesCountOther,
                        { n: c.patterns.length },
                      )}
                      {c.pattern ? `  ·  ${c.pattern}` : ""}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    if (confirmingId === c.id) {
                      removeConstruction(c.id);
                      setConfirmingId(null);
                    } else {
                      setConfirmingId(c.id);
                      // Auto-cancel the danger state after 3s — single-tap delete
                      // is too aggressive but a long flow with Alert.alert breaks
                      // on web/sim previews, so a two-tap-with-timeout is the
                      // pragmatic middle ground.
                      setTimeout(() => setConfirmingId((cur) => (cur === c.id ? null : cur)), 3000);
                    }
                  }}
                  hitSlop={12}
                  accessibilityLabel={
                    confirmingId === c.id
                      ? t.personalGrammar.confirmRemoveA11y
                      : t.personalGrammar.removeConstructionA11y
                  }
                  style={{ padding: 8 }}
                >
                  <Trash2
                    color={confirmingId === c.id ? theme.colors.danger : theme.colors.textTertiary}
                    size={18}
                    strokeWidth={2}
                  />
                </Pressable>
                <ChevronRight color={theme.colors.textTertiary} size={20} strokeWidth={2} />
              </View>
            </Card>
          ))}
        </View>

        <Text variant="caption" color="tertiary" style={{ marginTop: theme.spacing.md }}>
          {t.personalGrammar.tipLabel}
        </Text>
        <Text variant="small" color="secondary">
          {t.personalGrammar.tipBody}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function firstHanzi(name: string): string {
  const match = name.match(/^[一-鿿/.]+/);
  return match ? match[0] : "";
}
