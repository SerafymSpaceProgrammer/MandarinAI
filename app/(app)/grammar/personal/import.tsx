import { router } from "expo-router";
import { ArrowLeft, Download, FileJson } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Card, Input, Screen, Text, useToast } from "@/components/ui";
import {
  parseImport,
  useHydratedPersonalDeck,
  type ImportError,
} from "@/features/grammar/personal";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { useTheme } from "@/theme";

const SAMPLE = `{
  "constructions": [
    {
      "name": "把 bǎ",
      "ru_name": "Конструкция вынесения объекта",
      "pattern": "S + 把 + O + V + 了",
      "patterns": [
        { "zh": "我把书放在桌子上。", "py": "Wǒ bǎ shū fàng zài zhuōzi shàng.", "ru": "Я положил книгу на стол." },
        { "zh": "他把门关了。", "py": "Tā bǎ mén guān le.", "ru": "Он закрыл дверь." }
      ]
    }
  ]
}`;

export default function ImportPersonal() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const { importBundle } = useHydratedPersonalDeck();

  const [text, setText] = useState("");
  const [showSample, setShowSample] = useState(false);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    return parseImport(text);
  }, [text]);

  const stats = useMemo(() => statsFor(parsed), [parsed]);

  const handleImport = () => {
    if (!parsed || !parsed.ok) return;
    const result = importBundle(parsed.data);
    toast.success(
      fmt(t.personalGrammar.importedToast, {
        c: result.addedConstructions,
        p: result.addedPhrases,
      }),
    );
    router.replace("/(app)/grammar/personal");
  };

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
          <Text variant="h3">{t.personalGrammar.importTitle}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="small" color="secondary">
          {t.personalGrammar.importIntro}
        </Text>

        <Pressable
          onPress={() => setShowSample((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignSelf: "flex-start",
          }}
        >
          <FileJson color={theme.colors.textSecondary} size={16} strokeWidth={2} />
          <Text variant="smallStrong" color="secondary">
            {showSample ? t.personalGrammar.hideSample : t.personalGrammar.showSample}
          </Text>
        </Pressable>

        {showSample ? (
          <Pressable onPress={() => setText(SAMPLE)}>
            <Card padding="md" bordered>
              <Text variant="caption" color="tertiary" style={{ marginBottom: 6 }}>
                {t.personalGrammar.tapToInsert}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.latin,
                  fontSize: 12,
                  lineHeight: 18,
                  color: theme.colors.textSecondary,
                }}
                chinese
              >
                {SAMPLE}
              </Text>
            </Card>
          </Pressable>
        ) : null}

        <Input
          label={t.personalGrammar.jsonLabel}
          placeholder={t.personalGrammar.jsonPlaceholder}
          value={text}
          onChangeText={setText}
          multiline
          chinese
          style={{
            minHeight: 200,
            paddingTop: 12,
            paddingBottom: 12,
            textAlignVertical: "top",
            height: undefined,
          }}
        />

        {parsed && !parsed.ok ? (
          <Card padding="md" bordered style={{ borderColor: theme.colors.danger }}>
            <Text variant="smallStrong" color="danger" style={{ marginBottom: 4 }}>
              {t.personalGrammar.parseError}
            </Text>
            <Text variant="small" color="danger">
              {importErrorText(t, parsed.error)}
            </Text>
          </Card>
        ) : null}

        {parsed && parsed.ok && stats ? (
          <Card padding="md" bordered>
            <Text variant="smallStrong" style={{ marginBottom: 8 }}>
              {t.personalGrammar.previewTitle}
            </Text>
            <Text variant="small" color="secondary">
              {fmt(t.personalGrammar.previewStats, { c: stats.constructions, p: stats.phrases })}
            </Text>
            <View style={{ height: theme.spacing.sm }} />
            {parsed.data.constructions.slice(0, 5).map((c, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: theme.colors.border,
                }}
              >
                <Text chinese variant="bodyStrong">
                  {c.name}
                </Text>
                {c.ru_name ? (
                  <Text variant="small" color="secondary">
                    {c.ru_name}
                  </Text>
                ) : null}
                <Text variant="caption" color="tertiary">
                  {fmt(t.personalGrammar.phrasesShort, { n: c.patterns.length })}
                </Text>
              </View>
            ))}
            {parsed.data.constructions.length > 5 ? (
              <Text variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                {fmt(t.personalGrammar.andMore, { n: parsed.data.constructions.length - 5 })}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Button
          label={t.personalGrammar.importToDeck}
          variant="primary"
          disabled={!parsed || !parsed.ok}
          onPress={handleImport}
          leftIcon={<Download color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
          fullWidth
        />

        <Text variant="caption" color="tertiary" style={{ marginTop: theme.spacing.md }}>
          {t.personalGrammar.mergeRulesLabel}
        </Text>
        <Text variant="small" color="secondary">
          {t.personalGrammar.mergeRulesBody}
        </Text>
      </ScrollView>
    </Screen>
  );
}

/** Maps stable validator error codes to the user's language. */
function importErrorText(t: Translations, e: ImportError): string {
  const s = t.personalGrammar;
  switch (e.code) {
    case "invalidJson":
      return fmt(s.errInvalidJson, { msg: e.detail });
    case "expectedConstructions":
      return s.errExpectedConstructions;
    case "expectedObjectOrArray":
      return s.errExpectedObjectOrArray;
    case "emptyList":
      return s.errEmptyList;
    case "constructionNotObject":
      return fmt(s.errConstructionNotObject, { n: e.n });
    case "missingName":
      return fmt(s.errMissingName, { n: e.n });
    case "missingPatterns":
      return fmt(s.errMissingPatterns, { name: e.name });
    case "phraseNotObject":
      return fmt(s.errPhraseNotObject, { name: e.name, n: e.n });
    case "phraseMissingZh":
      return fmt(s.errPhraseMissingZh, { name: e.name, n: e.n });
    case "phraseMissingTranslation":
      return fmt(s.errPhraseMissingTranslation, { name: e.name, n: e.n });
  }
}

function statsFor(parsed: ReturnType<typeof parseImport> | null) {
  if (!parsed || !parsed.ok) return null;
  const c = parsed.data.constructions.length;
  const p = parsed.data.constructions.reduce((s, x) => s + x.patterns.length, 0);
  return { constructions: c, phrases: p };
}

