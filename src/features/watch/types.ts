export type WatchSource = "youtube" | "audio";

export type WatchEntry = {
  id: string;
  title: string;
  /** One-line description shown in the catalog row. */
  blurb: string;
  /** Longer description shown on the player screen. */
  description?: string;
  hskLevel: number;
  /** Approximate duration in seconds — for the catalog badge. */
  durationSec: number;
  source: WatchSource;
  /** Required when source === 'youtube'. */
  youtubeId?: string;
  /** Emoji shown as the catalog thumbnail when no real image is available. */
  emoji: string;
  /** Optional thumbnail URL — falls back to YouTube's hqdefault when missing. */
  thumbnail?: string;
  /** Path to the subtitle JSON inside data/videos/subtitles/. */
  subtitleId: string;
  /** "podcast" / "vlog" / "cartoon" / "lesson" — UI badge. */
  category: "podcast" | "vlog" | "cartoon" | "lesson" | "story";
};

export type SubtitleWord = {
  /** The hanzi (or punctuation / latin span) for this token. */
  text: string;
  /** True if the token is a CJK word — only those open the popup on tap. */
  tappable: boolean;
};

export type SubtitleLine = {
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** Raw Chinese text — kept for TTS / search. */
  zh: string;
  /** Pre-segmented tokens; renderer wraps each in a tappable span. */
  words: SubtitleWord[];
  /**
   * Translations keyed by language code. Loose typing because not every
   * language may be filled in for every line — UI falls back to en → zh.
   */
  translations: Partial<Record<string, string>>;
};

export type SubtitleTrack = {
  videoId: string;
  lines: SubtitleLine[];
};
