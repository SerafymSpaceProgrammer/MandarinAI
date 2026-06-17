import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sequential sentence player for reading stories.
 *
 * Drives expo-speech through a list of sentences in order, exposing the
 * current index so the caller can highlight the active sentence. The
 * player can also "jump" — tapping a per-sentence play button calls
 * `playOne(index)` to start narration from that specific line; subsequent
 * sentences continue playing on auto-pilot.
 *
 * On unmount or when the screen blurs the consumer should call `stop()`
 * so audio doesn't bleed into the next route — there's no global Speech
 * autostop in expo-router.
 */
export type SentencePlayerState = {
  /** Index of the currently-speaking sentence, or null if idle. */
  activeIndex: number | null;
  /** Whether a sentence is being narrated right now. */
  isPlaying: boolean;
  /** Start (or resume) playing from `index`. Auto-advances on completion. */
  playFrom: (index: number) => void;
  /** Cancel narration immediately. */
  stop: () => void;
};

const TTS_OPTS: Speech.SpeechOptions = {
  language: "zh-CN",
  rate: 0.85,
  pitch: 1,
};

export function useSentencePlayer(sentences: readonly string[]): SentencePlayerState {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // `current` mirrors `activeIndex` for use inside async callbacks where the
  // closed-over state would be stale.
  const current = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;

  const stop = useCallback(() => {
    cancelledRef.current = true;
    current.current = null;
    setActiveIndex(null);
    Speech.stop().catch(() => {});
  }, []);

  const speak = useCallback((index: number) => {
    const arr = sentencesRef.current;
    const text = arr[index];
    if (index < 0 || index >= arr.length || !text) {
      current.current = null;
      setActiveIndex(null);
      return;
    }
    current.current = index;
    setActiveIndex(index);
    cancelledRef.current = false;
    Speech.speak(text, {
      ...TTS_OPTS,
      onDone: () => {
        // onDone fires AFTER stop() too on some platforms; bail if we
        // explicitly cancelled to avoid an unwanted auto-advance.
        if (cancelledRef.current) return;
        if (current.current !== index) return;
        speak(index + 1);
      },
      onStopped: () => {
        // User-initiated stop — leave state alone, stop() already cleared.
      },
      onError: () => {
        current.current = null;
        setActiveIndex(null);
      },
    });
  }, []);

  const playFrom = useCallback(
    (index: number) => {
      // Restart from scratch — flush any in-flight utterance before queuing
      // the new one so we don't end up with overlapping voices.
      Speech.stop()
        .catch(() => {})
        .finally(() => speak(index));
    },
    [speak],
  );

  // Auto-stop when the consumer unmounts.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      Speech.stop().catch(() => {});
    };
  }, []);

  return {
    activeIndex,
    isPlaying: activeIndex !== null,
    playFrom,
    stop,
  };
}
