import { logger } from "@/lib/logger";

export type StrokeData = {
  /** SVG path `d` attributes for each stroke, in order. Rendered as a filled shape. */
  strokes: string[];
  /** Median (centerline) points per stroke — used to drive the reveal animation. */
  medians: Array<Array<[number, number]>>;
  /** Indices of strokes that form the radical (if any). Empty if unknown. */
  radStrokes?: number[];
};

const CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2";

// Single-session in-memory cache. At ~6–10KB per character, even a heavy
// browsing session tops out well under a megabyte.
const cache = new Map<string, StrokeData>();
const inflight = new Map<string, Promise<StrokeData | null>>();

export async function fetchStrokeData(hanzi: string): Promise<StrokeData | null> {
  if (hanzi.length !== 1) {
    // Data set is per-character; callers should split multi-char words.
    return null;
  }
  const cached = cache.get(hanzi);
  if (cached) return cached;
  const pending = inflight.get(hanzi);
  if (pending) return pending;

  const url = `${CDN}/${encodeURIComponent(hanzi)}.json`;
  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn("stroke data fetch failed", hanzi, res.status);
        return null;
      }
      const data = (await res.json()) as StrokeData;
      if (!Array.isArray(data.strokes) || !Array.isArray(data.medians)) {
        return null;
      }
      cache.set(hanzi, data);
      return data;
    } catch (err) {
      logger.warn("stroke data fetch error", hanzi, err);
      return null;
    } finally {
      inflight.delete(hanzi);
    }
  })();

  inflight.set(hanzi, promise);
  return promise;
}

/** Convert a median polyline to an SVG `d` string. */
export function medianToPathD(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");
}

/** Sum of segment lengths along a polyline. Used as the dasharray total. */
export function medianLength(points: Array<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const dx = cur[0] - prev[0];
    const dy = cur[1] - prev[1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  // Bump the value a touch so the reveal fully clears the stroke outline at
  // the end — the median doesn't quite reach the stroke extents.
  return Math.max(total * 1.15, 1);
}
