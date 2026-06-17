import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import {
  BookmarkCheck,
  BookmarkPlus,
  PenTool,
  Volume2,
  X as XIcon,
} from "lucide-react-native";
import { pinyin } from "pinyin-pro";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Modal, Text, useToast } from "@/components/ui";
import { StrokeViewerModal } from "@/components/StrokeViewerModal";
import { fetchTranslations } from "@/features/hsk/hsk";
import { addWord } from "@/features/vocab/vocab";
import { detectTone, splitSyllables } from "@/lib/pinyinTones";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The word the user tapped — single hanzi or multi-character compound. */
  hanzi: string;
  /** Optional context sentence to save with the word. */
  contextSentence?: string;
};

/**
 * Bottom-sheet popup invoked when the user taps a word in subtitles. Mirrors
 * the ChineseLens browser tooltip: pinyin (tone-coloured), meanings list,
 * TTS button, stroke viewer, and save-to-deck. The translate-meaning edge
 * function fills in the meanings asynchronously — we render a skeleton in
 * the gap so the popup feels responsive.
 */
export function WordPopup({ visible, onClose, hanzi, contextSentence }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const session = useUserStore((s) => s.session);
  const lang = useUserStore((s) => s.profile?.native_language ?? "en");

  const [meanings, setMeanings] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStrokes, setShowStrokes] = useState(false);
  const [saved, setSaved] = useState(false);

  // Derive pinyin locally with pinyin-pro — we can do this synchronously
  // while the meaning RPC is still in flight.
  const pinyinStr = useMemo<string>(() => {
    try {
      const result = pinyin(hanzi, { toneType: "symbol", v: true });
      return Array.isArray(result) ? result.join(" ") : String(result);
    } catch {
      return "";
    }
  }, [hanzi]);

  useEffect(() => {
    if (!visible || !hanzi) return;
    setMeanings(null);
    setSaved(false);
    setLoading(true);
    let cancelled = false;
    fetchTranslations([hanzi], lang)
      .then((res) => {
        if (cancelled) return;
        const list = res[hanzi] ?? [];
        setMeanings(list.length > 0 ? list : null);
      })
      .catch(() => {
        if (cancelled) return;
        setMeanings(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, hanzi, lang]);

  // Auto-play TTS when popup opens — same UX as ChineseLens.
  useEffect(() => {
    if (!visible || !hanzi) return;
    const id = setTimeout(() => {
      Speech.speak(hanzi, { language: "zh-CN", rate: 0.85 });
    }, 180);
    return () => {
      clearTimeout(id);
      Speech.stop().catch(() => {});
    };
  }, [visible, hanzi]);

  function speak() {
    Haptics.selectionAsync().catch(() => {});
    Speech.stop().catch(() => {});
    Speech.speak(hanzi, { language: "zh-CN", rate: 0.85 });
  }

  async function save() {
    if (!session || saved) return;
    const result = await addWord({
      userId: session.user.id,
      hanzi,
      pinyin: pinyinStr,
      english: meanings?.[0] ?? "",
      contextSentence: contextSentence ?? null,
    });
    if (result) {
      setSaved(true);
      toast.success("Сохранено в колоду");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      toast.error("Не удалось сохранить");
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} presentation="sheet">
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — hanzi big and centred, with tone-coloured pinyin */}
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Text
            chinese
            style={{
              fontSize: hanzi.length === 1 ? 96 : 72,
              lineHeight: hanzi.length === 1 ? 104 : 80,
              fontWeight: "700",
              color: theme.colors.textPrimary,
            }}
          >
            {hanzi}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.sm,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {splitSyllables(pinyinStr).map((syl, i) => (
              <Text key={i} variant="h3" tone={detectTone(syl)}>
                {syl}
              </Text>
            ))}
            <Pressable
              onPress={speak}
              hitSlop={12}
              accessibilityLabel="Озвучить"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.colors.accentMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Volume2 color={theme.colors.accent} size={18} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        {/* Context sentence */}
        {contextSentence ? (
          <View
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.accentMuted,
              gap: 4,
            }}
          >
            <Text variant="caption" color="accent">
              КОНТЕКСТ
            </Text>
            <Text chinese variant="body">
              {highlightHanzi(contextSentence, hanzi, theme.colors.accent)}
            </Text>
          </View>
        ) : null}

        {/* Meanings */}
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 6,
          }}
        >
          <Text variant="caption" color="tertiary">
            ЗНАЧЕНИЯ
          </Text>
          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 4 }} />
          ) : meanings && meanings.length > 0 ? (
            meanings.map((m, i) => (
              <Text key={i} variant="body">
                · {m}
              </Text>
            ))
          ) : (
            <Text variant="small" color="tertiary">
              Перевод не найден
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
          <ActionButton
            icon={<PenTool color={theme.colors.accent} size={16} strokeWidth={2.2} />}
            label="Черты"
            onPress={() => setShowStrokes(true)}
          />
          <ActionButton
            icon={
              saved ? (
                <BookmarkCheck color={theme.colors.success} size={16} strokeWidth={2.2} />
              ) : (
                <BookmarkPlus color={theme.colors.accent} size={16} strokeWidth={2.2} />
              )
            }
            label={saved ? "В колоде" : "В колоду"}
            onPress={save}
            disabled={saved || !session}
          />
          <ActionButton
            icon={<XIcon color={theme.colors.textSecondary} size={16} strokeWidth={2.2} />}
            label="Закрыть"
            onPress={onClose}
            tone="neutral"
          />
        </View>
      </ScrollView>

      <StrokeViewerModal
        visible={showStrokes}
        onClose={() => setShowStrokes(false)}
        hanzi={hanzi}
        pinyin={pinyinStr}
        english={meanings?.[0] ?? ""}
      />
    </Modal>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  tone = "accent",
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "accent" | "neutral";
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 10,
        borderRadius: theme.radii.full,
        backgroundColor:
          tone === "accent" ? theme.colors.accentMuted : theme.colors.surface,
        borderWidth: tone === "neutral" ? 1 : 0,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon}
      <Text
        variant="smallStrong"
        color={tone === "accent" ? "accent" : "secondary"}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Wrap occurrences of `target` inside the sentence with accent colour. */
function highlightHanzi(sentence: string, target: string, accent: string): React.ReactNode {
  if (!target) return sentence;
  const parts = sentence.split(target);
  if (parts.length === 1) return sentence;
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (p) out.push(p);
    if (i < parts.length - 1) {
      out.push(
        <Text key={`hl-${i}`} chinese variant="bodyStrong" style={{ color: accent }}>
          {target}
        </Text>,
      );
    }
  });
  return out;
}
