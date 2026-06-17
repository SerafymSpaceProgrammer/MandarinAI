import * as Speech from "expo-speech";
import { Pause, Play, RotateCcw } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import { useTheme } from "@/theme";

import type { SubtitleTrack } from "./types";

type Props = {
  track: SubtitleTrack;
  /** Total expected duration in seconds — bounds the timer. */
  durationSec: number;
  /** Fired ~10×/sec with the current playhead in seconds. */
  onTimeUpdate: (t: number) => void;
  /** True when the parent has shown a popup; we pause + suppress TTS. */
  paused: boolean;
};

/**
 * TTS-driven "podcast" player. Walks the subtitle track in order; for each
 * line, fires Speech.speak and advances the visual playhead at 100 ms ticks.
 * The parent owns the popup — when the user taps a word we just stop TTS
 * and freeze the timer; resuming re-plays the current line from its start
 * so the user doesn't have to mentally reconstruct what they missed.
 */
export function AudioPlayer({ track, durationSec, onTimeUpdate, paused }: Props) {
  const theme = useTheme();
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(true);
  // Which line index is currently being spoken. -1 = before first / between.
  const lineIndexRef = useRef(-1);
  // Accumulator we drive ourselves — we don't trust setInterval drift.
  const timeRef = useRef(0);
  const lastTickRef = useRef(Date.now());

  // Speak the line whose interval contains `t`. If we already started
  // speaking it, skip — Speech.speak would interrupt itself.
  const speakLineIfNeeded = useCallback(
    (t: number) => {
      const idx = track.lines.findIndex((l) => t >= l.start && t < l.end);
      if (idx === -1) return;
      if (lineIndexRef.current === idx) return;
      lineIndexRef.current = idx;
      const line = track.lines[idx]!;
      Speech.stop().catch(() => {});
      Speech.speak(line.zh, { language: "zh-CN", rate: 0.9 });
    },
    [track],
  );

  useEffect(() => {
    if (!running || paused) return;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const next = Math.min(durationSec, timeRef.current + dt);
      timeRef.current = next;
      setTime(next);
      onTimeUpdate(next);
      speakLineIfNeeded(next);
      if (next >= durationSec) {
        setRunning(false);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, paused, durationSec, onTimeUpdate, speakLineIfNeeded]);

  // When parent pauses (popup open) — silence TTS but keep timeRef intact.
  useEffect(() => {
    if (paused) {
      Speech.stop().catch(() => {});
      // Drop the line index so resuming re-fires the current line for
      // context. Without this the user might miss the second half of the
      // sentence they were in.
      lineIndexRef.current = -1;
    }
  }, [paused]);

  // Stop TTS on unmount.
  useEffect(() => {
    return () => {
      Speech.stop().catch(() => {});
    };
  }, []);

  function toggle() {
    if (paused) return; // popup is open — parent controls
    setRunning((r) => !r);
    if (running) {
      Speech.stop().catch(() => {});
    } else {
      lineIndexRef.current = -1; // re-fire current line on resume
    }
  }

  function restart() {
    Speech.stop().catch(() => {});
    timeRef.current = 0;
    setTime(0);
    onTimeUpdate(0);
    lineIndexRef.current = -1;
    setRunning(true);
  }

  const pct = durationSec > 0 ? Math.min(1, time / durationSec) : 0;
  const Icon = running && !paused ? Pause : Play;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <Pressable
          onPress={toggle}
          accessibilityLabel={running ? "Пауза" : "Воспроизвести"}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon color={theme.colors.onAccent} size={26} strokeWidth={2.4} />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${pct * 100}%`,
                height: "100%",
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="caption" color="tertiary">
              {formatTime(time)}
            </Text>
            <Text variant="caption" color="tertiary">
              {formatTime(durationSec)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={restart}
          accessibilityLabel="Сначала"
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RotateCcw color={theme.colors.textSecondary} size={20} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
