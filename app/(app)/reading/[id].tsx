import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle2, Pause, Play } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import { recordActivity } from "@/features/activity/activity";
import { useSentencePlayer } from "@/features/reading/sentencePlayer";
import { findStory, type GradedStory } from "@/features/reading/stories";
import { segmentSubtitle } from "@/features/watch/segmenter";
import { WordPopup } from "@/features/watch/WordPopup";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

const SENTENCE_DELIM = /([。！？!?])/;

/**
 * Story reader. Splits the body into sentences, segments each into HSK-aware
 * tokens, and renders every CJK token as a tappable inline span. Tapping a
 * token opens the shared WordPopup with the full sentence as context — the
 * same affordance the watch feature uses, kept consistent across the app.
 *
 * Audio: a `useSentencePlayer` hook drives expo-speech through the sentence
 * list. A play/pause button on the header toggles narration of the whole
 * story; a small per-sentence play button lets the learner re-listen any
 * single line. The currently-spoken sentence is highlighted in accent so
 * the eye can follow along.
 */
export default function ReadingStoryScreen() {
  const theme = useTheme();
  const t = useT();
  const params = useLocalSearchParams<{ id?: string }>();
  const session = useUserStore((s) => s.session);

  const story: GradedStory | null = params.id ? findStory(params.id) : null;

  const sentences = useMemo<string[]>(() => {
    if (!story) return [];
    return splitIntoSentences(story.bodyZh);
  }, [story]);

  const player = useSentencePlayer(sentences);

  const [openWord, setOpenWord] = useState<{ hanzi: string; context: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(() => Date.now());

  if (!story) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
          <Text variant="h2">{t.common.error}</Text>
          <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (finished) {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    return (
      <FinishedView
        story={story}
        minutes={minutes}
        onPickAnother={() => router.replace("/(app)/reading")}
        onHome={() => router.replace("/(app)")}
      />
    );
  }

  function markRead() {
    if (!session || !story) return;
    player.stop();
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    recordActivity(session.user.id, {
      minutes_studied: minutes,
      // Reading scales XP with story length — 5 XP for HSK 1, 8 for HSK 2, 12 for HSK 3.
      xp_earned: story.hskLevel === 1 ? 5 : story.hskLevel === 2 ? 8 : 12,
    });
    setFinished(true);
  }

  function togglePlay() {
    if (player.isPlaying) {
      player.stop();
    } else {
      player.playFrom(0);
    }
  }

  return (
    <Screen padded>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable
          onPress={() => {
            player.stop();
            router.back();
          }}
          hitSlop={16}
          accessibilityLabel={t.common.back}
        >
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {fmt(t.reading.storyEyebrow, { n: story.hskLevel })}
          </Text>
          <Text variant="h3" chinese>
            {story.titleZh}
          </Text>
          <Text variant="small" color="secondary">
            {story.pinyinTitle}
          </Text>
        </View>
        <PlayHeaderButton
          isPlaying={player.isPlaying}
          onPress={togglePlay}
          labelPlay={t.reading.playAll}
          labelPause={t.reading.pause}
        />
        <Text style={{ fontSize: 28, marginLeft: 4 }}>{story.emoji}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing["3xl"],
          gap: theme.spacing.lg,
        }}
      >
        {/* Sentences */}
        <View style={{ gap: theme.spacing.md }}>
          {sentences.map((sentence, idx) => (
            <SentenceLine
              key={idx}
              sentence={sentence}
              active={player.activeIndex === idx}
              onTapWord={(hanzi) => setOpenWord({ hanzi, context: sentence })}
              onPressPlay={() => player.playFrom(idx)}
            />
          ))}
        </View>

        <Button
          label={t.reading.finishLabel}
          size="lg"
          fullWidth
          leftIcon={<CheckCircle2 color={theme.colors.onAccent} size={18} strokeWidth={2.4} />}
          onPress={markRead}
          disabled={!session}
        />
      </ScrollView>

      <WordPopup
        visible={openWord !== null}
        onClose={() => setOpenWord(null)}
        hanzi={openWord?.hanzi ?? ""}
        contextSentence={openWord?.context}
      />
    </Screen>
  );
}

function PlayHeaderButton({
  isPlaying,
  onPress,
  labelPlay,
  labelPause,
}: {
  isPlaying: boolean;
  onPress: () => void;
  labelPlay: string;
  labelPause: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? labelPause : labelPlay}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: isPlaying ? theme.colors.accent : theme.colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isPlaying ? (
        <Pause color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
      ) : (
        <Play
          color={theme.colors.accent}
          size={18}
          strokeWidth={2.4}
          style={{ marginLeft: 1 /* visual centre of triangle */ }}
        />
      )}
    </Pressable>
  );
}

function SentenceLine({
  sentence,
  active,
  onTapWord,
  onPressPlay,
}: {
  sentence: string;
  active: boolean;
  onTapWord: (hanzi: string) => void;
  onPressPlay: () => void;
}) {
  const theme = useTheme();
  const tokens = useMemo(() => segmentSubtitle(sentence), [sentence]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: theme.spacing.sm,
        padding: active ? theme.spacing.sm : 0,
        borderRadius: theme.radii.md,
        backgroundColor: active ? theme.colors.accentMuted : "transparent",
      }}
    >
      <Pressable
        onPress={onPressPlay}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Play sentence"
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          marginTop: 4,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Play color={theme.colors.accent} size={12} strokeWidth={2.6} style={{ marginLeft: 1 }} />
      </Pressable>

      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" }}>
        {tokens.map((tok, i) => {
          if (!tok.tappable) {
            return (
              <Text key={i} chinese variant="body" color="primary" style={{ fontSize: 20, lineHeight: 32 }}>
                {tok.text}
              </Text>
            );
          }
          return (
            <Pressable
              key={i}
              onPress={() => onTapWord(tok.text)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={tok.text}
            >
              <Text
                chinese
                variant="body"
                color="primary"
                style={{
                  fontSize: 20,
                  lineHeight: 32,
                  color: theme.colors.textPrimary,
                  textDecorationLine: "underline",
                  textDecorationStyle: "dotted",
                  textDecorationColor: theme.colors.border,
                }}
              >
                {tok.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FinishedView({
  story,
  minutes,
  onPickAnother,
  onHome,
}: {
  story: GradedStory;
  minutes: number;
  onPickAnother: () => void;
  onHome: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const xp = story.hskLevel === 1 ? 5 : story.hskLevel === 2 ? 8 : 12;

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing["2xl"] }}>
        <View style={{ alignItems: "center", gap: theme.spacing.md }}>
          <Text style={{ fontSize: 72, lineHeight: 80 }}>{story.emoji}</Text>
          <Text variant="h1" align="center">
            {t.reading.finishedTitle}
          </Text>
          <Card padding="md" bordered style={{ alignItems: "center" }}>
            <Text variant="body" color="secondary" align="center">
              {fmt(t.reading.finishedBody, { xp, min: minutes })}
            </Text>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t.reading.finishedKeepReading} size="lg" fullWidth onPress={onPickAnother} />
          <Button label={t.reading.finishedHome} variant="secondary" fullWidth onPress={onHome} />
        </View>
      </View>
    </Screen>
  );
}

/**
 * Split a Chinese paragraph into sentences on terminal punctuation, keeping
 * the punctuation attached to the preceding sentence so the rendered text
 * still reads naturally. Empty entries (consecutive punctuation) are dropped.
 */
function splitIntoSentences(text: string): string[] {
  const parts = text.split(SENTENCE_DELIM);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] ?? "";
    const punct = parts[i + 1] ?? "";
    const combined = (body + punct).trim();
    if (combined.length > 0) out.push(combined);
  }
  return out;
}
