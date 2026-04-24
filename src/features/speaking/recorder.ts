import { Audio } from "expo-av";

import { logger } from "@/lib/logger";

export type RecordingHandle = {
  stop: () => Promise<{ uri: string; mimeType: string; size: number } | null>;
};

let activeRecording: Audio.Recording | null = null;

/**
 * Ensures microphone permission. Returns true if granted (or already granted).
 * Call once before starting the first recording — the RN permission prompt
 * is modal, so we keep it at the edge.
 */
export async function ensureMicPermission(): Promise<boolean> {
  const status = await Audio.requestPermissionsAsync();
  if (!status.granted) {
    logger.warn("mic permission denied");
    return false;
  }
  return true;
}

/**
 * Start recording. Returns a handle whose stop() resolves to the recorded
 * file URI + mime type. If called while another recording is still active,
 * cleanly tears it down first.
 */
export async function startRecording(): Promise<RecordingHandle> {
  if (activeRecording) {
    try {
      await activeRecording.stopAndUnloadAsync();
    } catch {
      // already stopped
    }
    activeRecording = null;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync({
    android: {
      extension: ".m4a",
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 96000,
    },
    ios: {
      extension: ".m4a",
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.MEDIUM,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 96000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: "audio/webm",
      bitsPerSecond: 96000,
    },
  });
  await recording.startAsync();
  activeRecording = recording;

  return {
    stop: async () => {
      if (activeRecording !== recording) return null;
      try {
        await recording.stopAndUnloadAsync();
      } catch (err) {
        logger.warn("stopAndUnloadAsync error", err);
      }
      activeRecording = null;

      const uri = recording.getURI();
      if (!uri) return null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const status = recording._finalDurationMillis;
      void status;

      return {
        uri,
        mimeType: uri.endsWith(".m4a") ? "audio/m4a" : "audio/mp4",
        size: 0, // populated by the score client after the file read
      };
    },
  };
}

export async function cancelActiveRecording(): Promise<void> {
  if (!activeRecording) return;
  try {
    await activeRecording.stopAndUnloadAsync();
  } catch {
    // ignore
  }
  activeRecording = null;
}
