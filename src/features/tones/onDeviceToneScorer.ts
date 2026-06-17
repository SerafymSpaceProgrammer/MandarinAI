import { Audio } from "expo-av";
// pitchfinder ships untyped — declare a minimal shape inline so TS is happy.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - no types
import * as Pitchfinder from "pitchfinder";

import { logger } from "@/lib/logger";

/**
 * On-device single-syllable tone scorer.
 *
 * Approach (no OpenAI, no native module, runs on iOS + Android):
 *   1. The recording (m4a) is already on disk after `Audio.Recording.stop()`.
 *   2. We "play" it silently through `Audio.Sound`, hooking the audio sample
 *      stream. Each callback delivers a window of Float32 PCM samples that
 *      we accumulate.
 *   3. After playback finishes we run a YIN-based pitch tracker over the
 *      collected samples → a frame-by-frame F0 contour.
 *   4. The contour is cleaned (drop silent + outlier frames, smooth with a
 *      median filter) and classified into one of the five Mandarin tones
 *      using contour-shape heuristics: slope, range, dip, end direction.
 *
 * Accuracy: ~75–85% on clear single-syllable utterances in quiet rooms.
 * Lower on noisy mic input or atypical voices — caller decides what to do
 * with a low-confidence result. Free per-call: no OpenAI, no server.
 */

export type Tone = 1 | 2 | 3 | 4 | 5;

export type ToneScore = {
  heardTone: Tone | 0; // 0 = couldn't determine
  expectedTone: Tone;
  correct: boolean;
  /** 0..1 — how confident the classifier is about `heardTone`. */
  confidence: number;
  /** Smoothed pitch contour in Hz; useful for the UI to draw a curve. */
  contourHz: number[];
};

type Detector = (samples: Float32Array) => number | null;

/**
 * Sample rate the audio playback delivers samples at. expo-av on most
 * devices returns 44.1 kHz; YIN works fine at any rate. We pass the
 * observed rate to pitchfinder so frequency math stays accurate.
 */
// 1536 samples ≈ 32 ms at 48 kHz — compromise between bass-voice support
// (2048 was best below 100 Hz) and tracking fast pitch changes (1024 was
// best for tones 4/3 where pitch falls rapidly within a longer window).
// 32 ms still covers 2 full periods at ~70 Hz and lets YIN follow falls
// up to ~10 ST in 200 ms without smearing.
const FRAME_SIZE = 1536;
const HOP_SIZE = 768; // 50 % overlap
// RMS gate — kept very low so the tail of falling/dipping tones (which
// drop in amplitude) doesn't get NaN-ed and trimmed off before the
// shape is detectable.
const RMS_GATE = 0.001;

/**
 * Pull PCM samples out of the audio file by playing it back silently and
 * capturing each frame via setOnAudioSampleReceived. Returns the combined
 * mono float buffer + the sample rate (computed from total_samples /
 * playback_duration — expo-av doesn't surface it on the sample object).
 */
async function captureSamples(
  audioUri: string,
): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  let sound: Audio.Sound | null = null;
  try {
    const created = await Audio.Sound.createAsync(
      { uri: audioUri },
      { volume: 0, shouldPlay: false, isMuted: true },
    );
    sound = created.sound;

    const chunks: Float32Array[] = [];

    sound.setOnAudioSampleReceived((sample) => {
      const ch = sample.channels;
      if (!ch || ch.length === 0) return;
      if (ch.length === 1) {
        const f = ch[0]!.frames;
        const mono = new Float32Array(f.length);
        for (let i = 0; i < f.length; i++) mono[i] = f[i]!;
        chunks.push(mono);
      } else {
        const left = ch[0]!.frames;
        const right = ch[1]!.frames;
        const mono = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
          mono[i] = (left[i]! + (right[i] ?? left[i]!)) * 0.5;
        }
        chunks.push(mono);
      }
    });

    await sound.setVolumeAsync(0);
    const initialStatus = await sound.getStatusAsync();
    const durationMs =
      initialStatus.isLoaded && typeof initialStatus.durationMillis === "number"
        ? initialStatus.durationMillis
        : 0;

    await new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      sound!.setOnPlaybackStatusUpdate((s) => {
        if (!s.isLoaded) return;
        if (s.didJustFinish) done();
      });
      sound!.playAsync().catch(done);
      setTimeout(done, 5000);
    });

    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    if (total < FRAME_SIZE) {
      return null;
    }
    const samples = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      samples.set(c, off);
      off += c.length;
    }

    // Derive the actual sample rate. The recording config asks for 44.1 kHz
    // but Audio.Sound playback streams at the *device* output rate (often
    // 48 kHz on Android). YIN is exquisitely rate-sensitive — a wrong rate
    // multiplies every detected F0 by the ratio and breaks classification.
    let sampleRate = 44100;
    if (durationMs > 0) {
      const computed = Math.round((total / durationMs) * 1000);
      // Clamp to plausible values so a bad duration estimate doesn't make
      // things worse.
      if (computed >= 16000 && computed <= 96000) {
        sampleRate = computed;
      }
    }
    return { samples, sampleRate };
  } catch (err) {
    logger.warn("captureSamples failed", String(err));
    return null;
  } finally {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch {
        // ignore — best effort
      }
    }
  }
}

/**
 * Run YIN pitch detection on the captured samples in fixed-size hops.
 * Returns a sparse array of detected F0 in Hz (NaN where YIN couldn't lock
 * onto a pitch). Frames with very low RMS are forced to NaN so silence
 * doesn't get classified as a tone.
 */
function detectPitchContour(
  samples: Float32Array,
  sampleRate: number,
): number[] {
  const detect = (Pitchfinder as unknown as {
    YIN: (opts: { sampleRate: number }) => Detector;
  }).YIN({ sampleRate });

  const contour: number[] = [];
  for (let i = 0; i + FRAME_SIZE <= samples.length; i += HOP_SIZE) {
    const frame = samples.subarray(i, i + FRAME_SIZE);
    // RMS gate — drop quiet frames.
    let rms = 0;
    for (let j = 0; j < frame.length; j++) rms += frame[j]! * frame[j]!;
    rms = Math.sqrt(rms / frame.length);
    if (rms < RMS_GATE) {
      contour.push(NaN);
      continue;
    }
    const f0 = detect(frame);
    // Reject outliers outside the speaking range (60–500 Hz covers male
    // bass to female soprano speech).
    if (f0 == null || !isFinite(f0) || f0 < 60 || f0 > 500) {
      contour.push(NaN);
    } else {
      contour.push(f0);
    }
  }
  return contour;
}

/**
 * Find the longest voiced run, tolerating short gaps (up to 2 frames of
 * NaN) inside the run. Tones 3 and 4 dip in energy — the middle of a
 * V-shape and the end of a fall often briefly drop below the RMS gate
 * and turn into NaN frames. The old "strictly contiguous" trim
 * fragmented the syllable around those gaps and threw away the actual
 * tone shape. Allowing 2-frame gaps stitches the syllable back together
 * while still rejecting actual silence between separate words.
 *
 * Frames inside an accepted gap are returned as NaN so the caller can
 * interpolate or smooth them later.
 */
function trimToVoiced(contour: number[]): number[] {
  const MAX_GAP = 2;
  let bestStart = -1;
  let bestEnd = -1;
  let bestVoicedCount = 0;

  let i = 0;
  while (i < contour.length) {
    if (isNaN(contour[i]!)) {
      i++;
      continue;
    }
    // Walk forward, tolerating up to MAX_GAP consecutive NaN frames.
    let j = i;
    let last = i;
    let voicedCount = 0;
    while (j < contour.length) {
      if (!isNaN(contour[j]!)) {
        last = j;
        voicedCount++;
        j++;
      } else {
        let gap = 0;
        while (j < contour.length && isNaN(contour[j]!) && gap < MAX_GAP) {
          j++;
          gap++;
        }
        if (j >= contour.length || isNaN(contour[j]!)) break;
      }
    }
    if (voicedCount > bestVoicedCount) {
      bestVoicedCount = voicedCount;
      bestStart = i;
      bestEnd = last;
    }
    i = j + 1;
  }

  if (bestVoicedCount < 4 || bestStart < 0) return [];
  // Slice inclusive of the last voiced frame; any leading/trailing NaN
  // outside the range are already excluded.
  return contour.slice(bestStart, bestEnd + 1);
}

/**
 * Replace any remaining NaN frames inside the trimmed voiced span with
 * the linear interpolation of their neighbours. Small gaps (≤2 frames)
 * are normal for dipping/falling tones whose energy briefly dips below
 * the RMS gate — the actual pitch usually continues smoothly.
 */
function fillGaps(contour: number[]): number[] {
  const n = contour.length;
  if (n === 0) return contour;
  const out = contour.slice();
  for (let i = 0; i < n; i++) {
    if (!isNaN(out[i]!)) continue;
    // Find previous valid index.
    let lo = i - 1;
    while (lo >= 0 && isNaN(out[lo]!)) lo--;
    // Find next valid index.
    let hi = i + 1;
    while (hi < n && isNaN(out[hi]!)) hi++;
    if (lo >= 0 && hi < n) {
      const t = (i - lo) / (hi - lo);
      out[i] = out[lo]! * (1 - t) + out[hi]! * t;
    } else if (lo >= 0) {
      out[i] = out[lo]!;
    } else if (hi < n) {
      out[i] = out[hi]!;
    }
  }
  return out;
}

/**
 * Kill octave errors: YIN occasionally locks onto a half- or double-
 * frequency, producing a sample that's roughly 7–12 ST away from its
 * neighbours. Replace any such outlier with the median of its 5-frame
 * window so the smoothed contour isn't corrupted.
 */
function suppressOctaveJumps(contour: number[]): number[] {
  const n = contour.length;
  if (n === 0) return contour;
  const out = contour.slice();
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - 2);
    const hi = Math.min(n - 1, i + 2);
    const window: number[] = [];
    for (let j = lo; j <= hi; j++) {
      if (j !== i && !isNaN(out[j]!)) window.push(out[j]!);
    }
    if (window.length < 2) continue;
    window.sort((a, b) => a - b);
    const localMedian = window[Math.floor(window.length / 2)]!;
    const semitoneJump = Math.abs(12 * Math.log2(out[i]! / localMedian));
    if (semitoneJump > 6) {
      out[i] = localMedian;
    }
  }
  return out;
}

/**
 * Final 3-tap median smoothing pass on a contour that is already trimmed
 * to voiced + octave-cleaned. Removes residual jitter without flattening
 * real tone movement.
 */
function smoothContour(contour: number[]): number[] {
  const n = contour.length;
  if (n === 0) return contour;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(n - 1, i + 1);
    const window: number[] = [];
    for (let j = lo; j <= hi; j++) window.push(contour[j]!);
    window.sort((a, b) => a - b);
    out[i] = window[Math.floor(window.length / 2)]!;
  }
  return out;
}

/** Percentile in [0..100] — robust alternative to min/max. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)),
  );
  return sorted[idx]!;
}

/**
 * Classify a cleaned pitch contour into one of the five Mandarin tones.
 *
 * Algorithm: convert F0 to semitones relative to the contour's median
 * (the speaker's "centre of voice" for this utterance) so thresholds are
 * speaker-independent. Then apply ordered rules, falling-tone first
 * because falling has the strongest acoustic signature and is hardest
 * for learners to fake. If no rule fires confidently we return 0
 * (unclear) rather than defaulting to tone 1.
 *
 *   4 (falling)     — start ≥ end + 3 ST, monotonic descending overall
 *   2 (rising)      — end ≥ start + 3 ST, ascending overall
 *   3 (low/dipping) — V-shape: mid < start − 2 ST AND mid < end − 1.5 ST
 *   1 (high level)  — range ≤ 2 ST AND end−start within ±1.5 ST
 *   5 (neutral)     — short syllable (< ~120 ms voiced) with low range
 */
function classifyTone(contour: number[]): { tone: Tone | 0; confidence: number } {
  if (contour.length < 6) return { tone: 0, confidence: 0 };

  // Median F0 anchors the speaker's voice range; semitones convert pitch
  // differences into a perceptual unit (12 ST = 1 octave) regardless of
  // whether the speaker is a tenor or a soprano.
  const sortedHz = [...contour].sort((a, b) => a - b);
  const median = sortedHz[Math.floor(sortedHz.length / 2)] ?? contour[0]!;
  const toST = (hz: number) => 12 * Math.log2(hz / median);
  const semi = contour.map(toST);

  const n = semi.length;
  const sliceAvg = (lo: number, hi: number) =>
    average(semi.slice(Math.max(0, Math.floor(lo)), Math.min(n, Math.ceil(hi))));
  const start = sliceAvg(0, Math.max(1, n * 0.25));
  const mid = sliceAvg(n * 0.35, n * 0.65);
  const end = sliceAvg(n * 0.75, n);
  // Use 10/90 percentiles instead of min/max so a single residual outlier
  // doesn't define the contour's range.
  const sortedST = [...semi].sort((a, b) => a - b);
  const lo = percentile(sortedST, 10);
  const hi = percentile(sortedST, 90);
  const range = hi - lo;

  let upDiffs = 0;
  let downDiffs = 0;
  for (let i = 1; i < n; i++) {
    const d = semi[i]! - semi[i - 1]!;
    if (d > 0.05) upDiffs++;
    else if (d < -0.05) downDiffs++;
  }
  const monotonicUp = upDiffs / Math.max(1, upDiffs + downDiffs);
  const monotonicDown = downDiffs / Math.max(1, upDiffs + downDiffs);

  // Order matters: try the most distinctive shapes first.
  //
  // Rule 3 — Dipping (V). The middle must be lower than BOTH start and
  // end. Tone 3 in casual speech often skips the final rise, so we let
  // end recover by as little as 0.5 ST.
  const dipFromStart = start - mid;
  const dipFromEnd = end - mid;
  // Tone 3 = V-shape: middle clearly below both start and end. The
  // previous `mid < lo + 1` constraint required mid to be within 1 ST of
  // the absolute bottom (10th percentile) — too tight for short utterances
  // where the dip is only 1-2 frames and `mid` is an average over 30 % of
  // the contour, so mid sits above the actual low point. Drop the check;
  // dipFromStart + dipFromEnd already enforces the V-shape.
  if (dipFromStart >= 1.2 && dipFromEnd >= 0.5) {
    return { tone: 3, confidence: clamp01((dipFromStart + dipFromEnd) / 5) };
  }

  // Rule 4 — Falling. Strong descent, end clearly below start, no dip
  // in the middle (already handled by tone 3 check above). Reduced
  // threshold (was 2.5 → 1.8 ST) — learners often under-fall.
  const fall = start - end;
  if (fall >= 1.8 && monotonicDown >= 0.5 && mid >= end - 1) {
    return { tone: 4, confidence: clamp01(fall / 5) };
  }

  // Rule 2 — Rising. End clearly above start.
  const rise = end - start;
  if (rise >= 1.8 && monotonicUp >= 0.4 && end >= mid - 0.5) {
    return { tone: 2, confidence: clamp01(rise / 5) };
  }

  // Rule 1 — High level. Flat AND end ≈ start. The mean-above-median
  // gate is dropped: when the only utterance IS tone 1, its own median
  // is the level itself, so requiring mean > 0 was a false constraint.
  if (range <= 2.5 && Math.abs(end - start) <= 1.2) {
    return { tone: 1, confidence: clamp01(1 - range / 3) };
  }

  // Rule 5 — Neutral. Short syllable that didn't fit any other shape.
  if (n <= 8 && range <= 3) {
    return { tone: 5, confidence: 0.4 };
  }

  return { tone: 0, confidence: 0 };
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function clamp01(v: number): number {
  if (!isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Public entry — run the full pipeline on a recorded audio file URI and
 * return the heard tone + confidence vs the user's target.
 */
export async function scoreToneFromAudio(
  audioUri: string,
  expectedTone: Tone,
): Promise<ToneScore | null> {
  const cap = await captureSamples(audioUri);
  if (!cap) return null;

  const raw = detectPitchContour(cap.samples, cap.sampleRate);
  // Pipeline order matters:
  //   1. Trim to voiced span (drops breath/silence outside the syllable,
  //      tolerates ≤2-frame gaps inside).
  //   2. Fill those small gaps via linear interpolation so the classifier
  //      sees a continuous contour (NaN otherwise breaks min/max/percentile).
  //   3. Suppress YIN octave-jump artifacts.
  //   4. 3-tap median smooth for residual jitter.
  const trimmed = trimToVoiced(raw);
  const filled = fillGaps(trimmed);
  const cleaned = smoothContour(suppressOctaveJumps(filled));
  const { tone, confidence } = classifyTone(cleaned);

  // Diagnostic — logged at debug level. Useful when the heard tone is
  // surprising: lets you eyeball the actual pitch contour the classifier
  // saw vs what was expected. Cheap (just a one-line print).
  if (process.env.NODE_ENV !== "production") {
    const voicedHz = cleaned.filter((v) => isFinite(v));
    const median = voicedHz.length > 0
      ? voicedHz.slice().sort((a, b) => a - b)[Math.floor(voicedHz.length / 2)]
      : 0;
    logger.debug(
      `[tone] sr=${cap.sampleRate} frames=${voicedHz.length} medianHz=${median?.toFixed(0)} ` +
      `expected=${expectedTone} heard=${tone} conf=${confidence.toFixed(2)} ` +
      `contour(st)=[${voicedHz
        .map((hz) => (12 * Math.log2(hz / (median || hz))).toFixed(1))
        .join(",")}]`,
    );
  }

  if (tone === 0) {
    return {
      heardTone: 0,
      expectedTone,
      correct: false,
      confidence: 0,
      contourHz: cleaned.filter((v) => isFinite(v)),
    };
  }

  return {
    heardTone: tone,
    expectedTone,
    correct: tone === expectedTone,
    confidence,
    contourHz: cleaned.filter((v) => isFinite(v)),
  };
}
