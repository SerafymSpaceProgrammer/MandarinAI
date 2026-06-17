import { segmentSubtitle } from "./segmenter";
import type {
  SubtitleLine,
  SubtitleTrack,
  WatchEntry,
} from "./types";

// The catalog and subtitle JSONs live under /data/videos. Metro inlines
// every static require — so adding a new video means: drop the JSON in
// place, append the catalog entry, and add a `case` to SUB_LOADERS below.
// Worth it: avoids a network fetch on screen open and keeps everything
// reproducible in TestFlight.
const RAW_CATALOG: { entries: WatchEntry[] } = require("../../../data/videos/catalog.json");

const SUB_LOADERS: Record<string, () => unknown> = {
  "self-intro-podcast": () =>
    require("../../../data/videos/subtitles/self-intro-podcast.json"),
  "weekend-vlog": () =>
    require("../../../data/videos/subtitles/weekend-vlog.json"),
  "demo-youtube-stub": () =>
    require("../../../data/videos/subtitles/demo-youtube-stub.json"),
};

const trackCache = new Map<string, SubtitleTrack>();

export function listEntries(): WatchEntry[] {
  return RAW_CATALOG.entries;
}

export function getEntry(id: string): WatchEntry | null {
  return RAW_CATALOG.entries.find((e) => e.id === id) ?? null;
}

export function getEntryLevels(): number[] {
  const set = new Set<number>();
  for (const e of RAW_CATALOG.entries) set.add(e.hskLevel);
  return [...set].sort((a, b) => a - b);
}

/**
 * Load and segment the subtitle track for an entry. The raw JSON has just
 * `zh` strings; we run the HSK-aware segmenter to produce tappable word
 * tokens at load time and cache the result so re-mounting the player doesn't
 * re-segment the same track.
 */
export function loadTrack(entry: WatchEntry): SubtitleTrack | null {
  const cached = trackCache.get(entry.subtitleId);
  if (cached) return cached;

  const loader = SUB_LOADERS[entry.subtitleId];
  if (!loader) return null;
  const raw = loader() as {
    videoId: string;
    lines: Array<{
      start: number;
      end: number;
      zh: string;
      translations?: Partial<Record<string, string>>;
    }>;
  };

  const lines: SubtitleLine[] = raw.lines.map((l) => ({
    start: l.start,
    end: l.end,
    zh: l.zh,
    words: segmentSubtitle(l.zh),
    translations: l.translations ?? {},
  }));
  const track: SubtitleTrack = { videoId: raw.videoId, lines };
  trackCache.set(entry.subtitleId, track);
  return track;
}

/** Find the line containing the given playhead time (or null between lines). */
export function lineAt(track: SubtitleTrack, t: number): SubtitleLine | null {
  for (const l of track.lines) {
    if (t >= l.start && t < l.end) return l;
  }
  return null;
}

/** Return the line's index in the track, or -1 if not present. */
export function indexOfLine(track: SubtitleTrack, line: SubtitleLine | null): number {
  if (!line) return -1;
  return track.lines.indexOf(line);
}
