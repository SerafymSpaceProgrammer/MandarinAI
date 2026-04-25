import { router } from "expo-router";
import { ArrowLeft, ChevronRight, PencilLine } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { fetchAllWords, type SavedWord } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

// hsk_words (the actual data source) only has full coverage for new-syllabus
// levels 1-5. Picker mirrors that to avoid leading the user into empty lists.
const HSK_LEVELS = [1, 2, 3, 4, 5];

/**
 * Picker for the writing trainer. The user chooses a source set; the
 * session screen handles the actual flow.
 */
export default function WritingPicker() {
  const theme = useTheme();
  const t = useT();
  const session = useUserStore((s) => s.session);

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<SavedWord[]>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchAllWords(session.user.id).then((data) => {
      if (cancelled) return;
      setWords(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Strokes are per-character — split saved words into individual hanzi so
  // the user can practice every glyph the deck contains.
  const deckChars = Array.from(
    new Set(words.flatMap((w) => Array.from(w.hanzi))),
  ).filter((c) => /\p{Script=Han}/u.test(c));

  return (
    <Screen>
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.writing.headerLabel}
          </Text>
          <Text variant="h3">{t.writing.pickerTitle}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing["3xl"],
        }}
      >
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.accentMuted,
            gap: 2,
          }}
        >
          <Text variant="caption" color="accent">
            {t.writing.headerLabel}
          </Text>
          <Text variant="small">{t.writing.pickerHint}</Text>
        </View>

        {/* Deck-based source */}
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" color="tertiary">
            {t.writing.sourceDeck}
          </Text>
          {loading ? (
            <View style={{ paddingVertical: theme.spacing.lg, alignItems: "center" }}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : deckChars.length === 0 ? (
            <Card bordered>
              <View style={{ gap: theme.spacing.xs }}>
                <Text variant="bodyStrong">{t.writing.deckEmpty}</Text>
                <Text variant="small" color="secondary">
                  {t.writing.deckEmptyHint}
                </Text>
              </View>
            </Card>
          ) : (
            <SourceCard
              title={t.writing.sourceDeck}
              hint={t.writing.sourceDeckHint}
              countLabel={fmt(t.writing.counter, {
                n: deckChars.length,
                total: deckChars.length,
              })}
              onPress={() =>
                router.push({
                  pathname: "/(app)/practice/writing-session",
                  params: { source: "deck" },
                })
              }
            />
          )}
        </View>

        {/* HSK levels */}
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" color="tertiary">
            {t.writing.sourceHsk}
          </Text>
          {HSK_LEVELS.map((lvl) => (
            <SourceCard
              key={lvl}
              title={fmt(t.hsk.topicHskBadge, { n: lvl })}
              hint={t.writing.sourceHskHint}
              onPress={() =>
                router.push({
                  pathname: "/(app)/practice/writing-session",
                  params: { source: "hsk", level: String(lvl) },
                })
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function SourceCard({
  title,
  hint,
  countLabel,
  onPress,
}: {
  title: string;
  hint: string;
  countLabel?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} bordered>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.colors.accentMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PencilLine color={theme.colors.accent} size={22} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="small" color="secondary">
            {hint}
          </Text>
          {countLabel ? (
            <Text variant="caption" color="tertiary">
              {countLabel}
            </Text>
          ) : null}
        </View>
        <ChevronRight color={theme.colors.textTertiary} size={20} strokeWidth={2} />
      </View>
    </Card>
  );
}
