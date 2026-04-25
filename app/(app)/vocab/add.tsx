import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { pinyin } from "pinyin-pro";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button, Input, Screen, Text, useToast } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { addWord } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function AddWord() {
  const theme = useTheme();
  const t = useT();
  const toast = useToast();
  const session = useUserStore((s) => s.session);

  const [hanzi, setHanzi] = useState("");
  const [pinyinValue, setPinyinValue] = useState("");
  const [english, setEnglish] = useState("");
  const [hskLevel, setHskLevel] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [autoPinyin, setAutoPinyin] = useState(true);

  useEffect(() => {
    if (!autoPinyin) return;
    if (!hanzi.trim()) {
      setPinyinValue("");
      return;
    }
    try {
      const auto = pinyin(hanzi, { toneType: "symbol", nonZh: "removed" });
      setPinyinValue(auto);
    } catch {
      // pinyin-pro throws on some edge cases; user can edit manually
    }
  }, [hanzi, autoPinyin]);

  async function save() {
    if (!session || busy) return;
    if (!hanzi.trim() || !english.trim()) {
      toast.error(t.vocab.add.requireBoth);
      return;
    }
    setBusy(true);
    const saved = await addWord({
      userId: session.user.id,
      hanzi,
      pinyin: pinyinValue,
      english,
      hskLevel,
    });
    setBusy(false);
    if (!saved) {
      toast.error(t.vocab.add.saveError);
      return;
    }
    toast.success(fmt(t.vocab.add.savedToast, { hanzi: saved.hanzi }));
    router.back();
  }

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
        <Text variant="h3">{t.vocab.add.title}</Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <Input
          label={t.vocab.add.hanziLabel}
          chinese
          value={hanzi}
          onChangeText={setHanzi}
          placeholder={t.vocab.review.hanziPlaceholder}
          autoFocus
        />
        <Input
          label={t.vocab.add.pinyinLabel}
          value={pinyinValue}
          onChangeText={(v) => {
            setAutoPinyin(false);
            setPinyinValue(v);
          }}
          placeholder="hàn zì"
          helper={autoPinyin ? t.vocab.add.pinyinHelper : undefined}
        />
        <Input
          label={t.vocab.add.meaningLabel}
          value={english}
          onChangeText={setEnglish}
          placeholder={t.vocab.add.meaningPlaceholder}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="smallStrong" color="secondary">
            {t.vocab.add.hskLabel}
          </Text>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            {[0, 1, 2, 3, 4, 5, 6].map((lvl) => {
              const active = hskLevel === lvl;
              return (
                <Pressable
                  key={lvl}
                  onPress={() => setHskLevel(lvl)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: theme.radii.md,
                    backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                  }}
                >
                  <Text variant="smallStrong" color={active ? "onAccent" : "secondary"}>
                    {lvl === 0 ? t.vocab.add.hskNone : fmt(t.vocab.browse.hskBadge, { n: lvl })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button label={t.vocab.add.saveBtn} onPress={save} loading={busy} size="lg" fullWidth />
      </ScrollView>
    </Screen>
  );
}
