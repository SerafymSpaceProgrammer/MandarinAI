import type { WidgetData } from "./HomeWidget";

/**
 * Refresh the on-device cache that the Android home-screen widget reads.
 *
 * Currently a NO-OP — the widget plugin is disabled in app.json while we
 * sort out the random Android crashes some handsets reported when the
 * widget JS task ran. The data writer keeps its signature so re-enabling
 * is a one-line change: restore the plugin in app.json and uncomment the
 * implementation below.
 */
export async function updateWidgetData(
  _patch: Partial<WidgetData>,
): Promise<void> {
  return;
}

export async function readWidgetData(): Promise<WidgetData> {
  return DEFAULT_DATA;
}

export const DEFAULT_DATA: WidgetData = {
  streak: 0,
  dueCount: 0,
  wordHanzi: null,
  wordPinyin: null,
  wordMeaning: null,
  greeting: "Mandarin",
};

/** Time-of-day greeting (kept here for the eventual re-enable). */
export function currentGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}
