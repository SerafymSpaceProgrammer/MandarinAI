import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Input, Screen, Text, useToast } from "@/components/ui";
import { useHydratedPersonalDeck } from "@/features/grammar/personal";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/theme";

export default function NewPersonalConstruction() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const { createConstruction } = useHydratedPersonalDeck();

  const [name, setName] = useState("");
  const [ruName, setRuName] = useState("");
  const [pattern, setPattern] = useState("");

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const id = createConstruction({ name, ru_name: ruName, pattern });
    toast.success(t.personalGrammar.createdToast);
    router.replace(`/(app)/grammar/personal/${id}`);
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
          <Text variant="h3">{t.personalGrammar.newTitle}</Text>
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
          {t.personalGrammar.newIntro}
        </Text>

        <Input
          label={t.personalGrammar.nameLabel}
          placeholder={t.personalGrammar.namePlaceholder}
          chinese
          value={name}
          onChangeText={setName}
          helper={t.personalGrammar.nameHelper}
        />

        <Input
          label={t.personalGrammar.descLabel}
          placeholder={t.personalGrammar.descPlaceholder}
          value={ruName}
          onChangeText={setRuName}
        />

        <Input
          label={t.personalGrammar.structLabel}
          placeholder={t.personalGrammar.structPlaceholder}
          value={pattern}
          onChangeText={setPattern}
          chinese
          helper={t.personalGrammar.structHelper}
        />

        <View style={{ height: theme.spacing.md }} />

        <Button
          label={t.personalGrammar.createConstruction}
          variant="primary"
          onPress={handleSave}
          disabled={!canSave}
          fullWidth
        />
      </ScrollView>
    </Screen>
  );
}
