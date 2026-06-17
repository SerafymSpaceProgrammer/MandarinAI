import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

import { logger } from "./logger";

/**
 * Configure the iOS / Android audio session for loud TTS playback.
 *
 * On iOS the default category routes media through the receiver (the small
 * earpiece speaker), which is barely audible — every TTS call sounded muted.
 * Setting `playsInSilentModeIOS: true` plus `allowsRecordingIOS: false` puts
 * the session into the playback category, which routes through the loud
 * bottom speaker. We also explicitly opt out of earpiece routing on Android.
 *
 * Speech recording (Whisper sessions) flips this to the recording category;
 * `restorePlaybackMode()` must be called when the recording ends to bring the
 * loud speaker back. Without that, every subsequent TTS call after a Whisper
 * session plays through the earpiece.
 */
export async function configurePlaybackMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
  } catch (err) {
    logger.warn("configurePlaybackMode error", err);
  }
}

/**
 * Alias used after a recording session finishes. Same settings — kept as a
 * separate function to keep call-sites intention-revealing.
 */
export const restorePlaybackMode = configurePlaybackMode;
