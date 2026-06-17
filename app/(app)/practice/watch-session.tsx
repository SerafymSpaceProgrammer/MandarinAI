import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Screen, Text } from "@/components/ui";
import { AudioPlayer } from "@/features/watch/AudioPlayer";
import { WordPopup } from "@/features/watch/WordPopup";
import {
  YouTubePlayer,
  type YouTubePlayerHandle,
} from "@/features/watch/YouTubePlayer";
import { getEntry, lineAt, loadTrack } from "@/features/watch/loader";
import type { SubtitleLine, SubtitleTrack } from "@/features/watch/types";
import { useT } from "@/i18n/i18n";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function WatchSession() {
  const theme = useTheme();
  const t = useT();
  const params = useLocalSearchParams<{ id?: string }>();
  const lang = useUserStore((s) => s.profile?.native_language ?? "en");

  const entry = useMemo(() => (params.id ? getEntry(params.id) : null), [params.id]);
  const track = useMemo<SubtitleTrack | null>(
    () => (entry ? loadTrack(entry) : null),
    [entry],
  );

  const [time, setTime] = useState(0);
  const [popupWord, setPopupWord] = useState<{
    hanzi: string;
    context: string;
  } | null>(null);
  const youtubeRef = useRef<YouTubePlayerHandle>(null);

  // Currently displayed line + memoized index for stable React keys.
  const activeLine = useMemo<SubtitleLine | null>(
    () => (track ? lineAt(track, time) : null),
    [track, time],
  );

  const onTimeUpdate = useCallback((t: number) => setTime(t), []);

  // When the popup opens we pause both players (audio paused state is
  // handled via the `paused` prop, YouTube via the imperative ref).
  useEffect(() => {
    if (popupWord && entry?.source === "youtube") {
      youtubeRef.current?.pause();
    }
  }, [popupWord, entry?.source]);

  function handleClosePopup() {
    setPopupWord(null);
    if (entry?.source === "youtube") {
      youtubeRef.current?.play();
    }
  }

  function tapWord(hanzi: string, context: string) {
    setPopupWord({ hanzi, context });
  }

  if (!entry) {
    return (
      <Screen padded>
        <Header onBack={() => router.back()} title={t.watch.notFound} />
      </Screen>
    );
  }

  if (!track) {
    return (
      <Screen padded>
        <Header onBack={() => router.back()} title={entry.title} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text variant="body" color="secondary">
            {t.watch.noSubtitles}
          </Text>
        </View>
      </Screen>
    );
  }

  const isYoutubePlaceholder =
    entry.source === "youtube" && entry.youtubeId === "TODO_REPLACE_WITH_REAL_ID";

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
            HSK {entry.hskLevel}  ·  {entry.category}
          </Text>
          <Text variant="h3" numberOfLines={1}>
            {entry.title}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing["5xl"],
        }}
      >
        {/* Player */}
        {entry.source === "youtube" && entry.youtubeId && !isYoutubePlaceholder ? (
          <YouTubePlayer
            ref={youtubeRef}
            youtubeId={entry.youtubeId}
            onTimeUpdate={setTime}
          />
        ) : entry.source === "youtube" && isYoutubePlaceholder ? (
          <PlaceholderBanner />
        ) : (
          <AudioPlayer
            track={track}
            durationSec={entry.durationSec}
            onTimeUpdate={onTimeUpdate}
            paused={popupWord !== null}
          />
        )}

        {/* Active subtitle */}
        <SubtitleView line={activeLine} lang={lang} onTapWord={tapWord} />

        {/* Description */}
        {entry.description ? (
          <Text variant="small" color="secondary">
            {entry.description}
          </Text>
        ) : null}
      </ScrollView>

      <WordPopup
        visible={popupWord !== null}
        onClose={handleClosePopup}
        hanzi={popupWord?.hanzi ?? ""}
        contextSentence={popupWord?.context}
      />
    </Screen>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
      }}
    >
      <Pressable onPress={onBack} hitSlop={16} accessibilityLabel={t.common.back}>
        <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
      </Pressable>
      <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function PlaceholderBanner() {
  const theme = useTheme();
  const t = useT();
  return (
    <View
      style={{
        padding: theme.spacing.lg,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: theme.colors.border,
        gap: theme.spacing.sm,
      }}
    >
      <Text variant="bodyStrong">{t.watch.notWired}</Text>
      <Text variant="small" color="secondary">
        {t.watch.notWiredBody}
      </Text>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SubtitleView — renders the active line with each tappable word as its own
// pressable span. Non-CJK tokens (punctuation, latin) render as plain text
// so taps fall through to nothing — feels right.
// ──────────────────────────────────────────────────────────────────────────
function SubtitleView({
  line,
  lang,
  onTapWord,
}: {
  line: SubtitleLine | null;
  lang: string;
  onTapWord: (word: string, context: string) => void;
}) {
  const theme = useTheme();
  const t = useT();

  if (!line) {
    return (
      <View
        style={{
          padding: theme.spacing.xl,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          minHeight: 140,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="caption" color="tertiary">
          {/* Between subtitles or before playback starts */}
          ...
        </Text>
      </View>
    );
  }

  const translation = line.translations[lang] ?? line.translations.en ?? "";

  return (
    <View
      style={{
        padding: theme.spacing.xl,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.md,
      }}
    >
      <Text variant="caption" color="tertiary">
        {t.watch.subtitlesLabel}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "baseline",
          // rowGap so multi-line subtitles don't smush; columnGap keeps
          // taps comfortable.
          rowGap: 6,
          columnGap: 2,
        }}
      >
        {line.words.map((tok, i) => {
          if (!tok.tappable) {
            return (
              <Text
                chinese
                key={i}
                style={{
                  fontSize: 28,
                  lineHeight: 36,
                  color: theme.colors.textPrimary,
                }}
              >
                {tok.text}
              </Text>
            );
          }
          return (
            <Pressable
              key={i}
              onPress={() => onTapWord(tok.text, line.zh)}
              accessibilityLabel={tok.text}
              hitSlop={4}
              style={({ pressed }) => ({
                paddingHorizontal: 2,
                borderRadius: 4,
                backgroundColor: pressed ? theme.colors.accentMuted : "transparent",
              })}
            >
              <Text
                chinese
                style={{
                  fontSize: 28,
                  lineHeight: 36,
                  fontWeight: "600",
                  color: theme.colors.textPrimary,
                }}
              >
                {tok.text}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {translation ? (
        <Text variant="body" color="secondary" style={{ marginTop: 4 }}>
          {translation}
        </Text>
      ) : null}
    </View>
  );
}
