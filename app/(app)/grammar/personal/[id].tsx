import { router, useLocalSearchParams } from "expo-router";
import { pinyin } from "pinyin-pro";
import {
  ArrowLeft,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import * as Speech from "expo-speech";

import { Button, Card, Input, Screen, Text, useToast } from "@/components/ui";
import { useHydratedPersonalDeck } from "@/features/grammar/personal";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useTheme } from "@/theme";

export default function PersonalConstructionDetail() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string }>();
  const { hydrated, getConstruction, addPhrase, removePhrase } = useHydratedPersonalDeck();
  const construction = hydrated && params.id ? getConstruction(params.id) : null;

  const [zh, setZh] = useState("");
  const [py, setPy] = useState("");
  const [ru, setRu] = useState("");

  const autoFillPinyin = useCallback(() => {
    if (!zh.trim()) return;
    try {
      const result = pinyin(zh.trim(), { toneType: "symbol", v: true });
      const text = (Array.isArray(result) ? result.join(" ") : String(result)).trim();
      const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
      setPy(capitalized);
    } catch {
      // pinyin-pro doesn't usually fail on common chars; fall through silently.
    }
  }, [zh]);

  const speak = useCallback(() => {
    if (!zh.trim()) return;
    Speech.stop();
    Speech.speak(zh.trim(), { language: "zh-CN", rate: 0.9 });
  }, [zh]);

  const handleAddPhrase = () => {
    if (!construction) return;
    const trimmedZh = zh.trim();
    const trimmedRu = ru.trim();
    if (!trimmedZh || !trimmedRu) {
      toast.error(t.personalGrammar.needZhAndTranslation);
      return;
    }
    addPhrase(construction.id, {
      zh: trimmedZh,
      py: py.trim(),
      ru: trimmedRu,
    });
    setZh("");
    setPy("");
    setRu("");
    toast.success(t.personalGrammar.phraseAddedToast);
  };

  if (!hydrated) {
    return <Screen padded><View style={{ flex: 1 }} /></Screen>;
  }

  if (!construction) {
    return (
      <Screen padded>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: theme.spacing.md,
          }}
        >
          <Text variant="h3">{t.personalGrammar.notFound}</Text>
          <Button label={t.personalGrammar.toDeck} onPress={() => router.replace("/(app)/grammar/personal")} />
        </View>
      </Screen>
    );
  }

  const phraseCount = construction.patterns.length;

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
            {t.personalGrammar.myConstructionEyebrow}  ·  {construction.pattern || t.personalGrammar.noTemplate}
          </Text>
          <Text chinese variant="h3" numberOfLines={1}>
            {construction.name}
          </Text>
        </View>
      </View>

      {construction.ru_name ? (
        <Text
          variant="small"
          color="secondary"
          style={{ marginBottom: theme.spacing.md }}
        >
          {construction.ru_name}
        </Text>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Button
          label={
            phraseCount > 0
              ? fmt(t.personalGrammar.trainWithCount, { n: phraseCount })
              : t.personalGrammar.addPhraseToTrain
          }
          variant="primary"
          disabled={phraseCount === 0}
          onPress={() =>
            router.push(`/(app)/grammar/${construction.id}?source=personal`)
          }
          leftIcon={<Play color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
          fullWidth
        />

        {/* Add-phrase form */}
        <Card padding="lg" bordered>
          <Text variant="bodyStrong" style={{ marginBottom: theme.spacing.md }}>
            {t.personalGrammar.addPhraseTitle}
          </Text>

          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: 6 }}>
              <Input
                label={t.personalGrammar.zhLabel}
                placeholder={t.personalGrammar.zhPlaceholder}
                chinese
                value={zh}
                onChangeText={setZh}
                multiline
              />
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <Pressable
                  onPress={autoFillPinyin}
                  disabled={!zh.trim()}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radii.full,
                    backgroundColor: theme.colors.accentMuted,
                    opacity: zh.trim() ? 1 : 0.4,
                  }}
                >
                  <Sparkles color={theme.colors.accent} size={14} strokeWidth={2.4} />
                  <Text variant="smallStrong" color="accent">
                    {t.personalGrammar.autoPinyin}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={speak}
                  disabled={!zh.trim()}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radii.full,
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    opacity: zh.trim() ? 1 : 0.4,
                  }}
                >
                  <Volume2 color={theme.colors.textSecondary} size={14} strokeWidth={2} />
                  <Text variant="smallStrong" color="secondary">
                    {t.personalGrammar.speakBtn}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Input
              label={t.personalGrammar.pyLabel}
              placeholder={t.personalGrammar.pyPlaceholder}
              value={py}
              onChangeText={setPy}
            />

            <Input
              label={t.personalGrammar.translationLabel}
              placeholder={t.personalGrammar.translationPlaceholder}
              value={ru}
              onChangeText={setRu}
              multiline
            />

            <Button
              label={t.personalGrammar.addPhrase}
              variant="primary"
              onPress={handleAddPhrase}
              disabled={!zh.trim() || !ru.trim()}
              leftIcon={<Plus color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
              fullWidth
            />
          </View>
        </Card>

        {/* Phrase list */}
        {phraseCount > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="caption" color="tertiary">
              {fmt(t.personalGrammar.phrasesListLabel, { n: phraseCount })}
            </Text>
            {construction.patterns.map((p, i) => (
              <Card key={`${p.zh}-${i}`} bordered padding="md">
                <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text chinese style={{ fontSize: 22, lineHeight: 28, fontWeight: "600" }}>
                      {p.zh}
                    </Text>
                    {p.py ? (
                      <Text variant="small" color="secondary">
                        {p.py}
                      </Text>
                    ) : null}
                    <Text variant="small">{p.ru}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      removePhrase(construction.id, i);
                      toast.info(t.personalGrammar.removedToast);
                    }}
                    hitSlop={12}
                    accessibilityLabel={t.personalGrammar.removePhraseA11y}
                    style={{ padding: 8 }}
                  >
                    <Trash2 color={theme.colors.textTertiary} size={18} strokeWidth={2} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
