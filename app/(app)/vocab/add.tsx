import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { pinyin } from "pinyin-pro";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button, Input, Screen, Text, useToast } from "@/components/ui";
import { addWord } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function AddWord() {
  const theme = useTheme();
  const toast = useToast();
  const session = useUserStore((s) => s.session);

  const [hanzi, setHanzi] = useState("");
  const [pinyinValue, setPinyinValue] = useState("");
  const [english, setEnglish] = useState("");
  const [hskLevel, setHskLevel] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [autoPinyin, setAutoPinyin] = useState(true);

  // Auto-fill pinyin from hanzi via pinyin-pro (offline, polyphonic-aware).
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
      // swallow — pinyin-pro throws on some edge cases; user can edit manually
    }
  }, [hanzi, autoPinyin]);

  async function save() {
    if (!session || busy) return;
    if (!hanzi.trim() || !english.trim()) {
      toast.error("Hanzi and meaning are required");
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
      toast.error("Couldn't save word");
      return;
    }
    toast.success(`Saved ${saved.hanzi}`);
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
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Back">
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <Text variant="h3">Add a word</Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <Input
          label="Hanzi"
          chinese
          value={hanzi}
          onChangeText={setHanzi}
          placeholder="汉字"
          autoFocus
        />
        <Input
          label="Pinyin"
          value={pinyinValue}
          onChangeText={(v) => {
            setAutoPinyin(false);
            setPinyinValue(v);
          }}
          placeholder="hàn zì"
          helper={autoPinyin ? "Auto-generated — edit to override" : undefined}
        />
        <Input
          label="Meaning"
          value={english}
          onChangeText={setEnglish}
          placeholder="character / word"
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="smallStrong" color="secondary">
            HSK level
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
                    {lvl === 0 ? "none" : `HSK ${lvl}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button label="Save" onPress={save} loading={busy} size="lg" fullWidth />
      </ScrollView>
    </Screen>
  );
}
