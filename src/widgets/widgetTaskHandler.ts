import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { logger } from "@/lib/logger";

import { HomeWidget } from "./HomeWidget";
import { currentGreeting, readWidgetData } from "./widgetData";

/**
 * Entry point Android calls every refresh window (configured to 30 min
 * via `updatePeriodMillis` in app.json) and whenever the widget is first
 * added to the home screen. Runs in a headless JS context — it cannot
 * read React state or call hooks, so it relies on the AsyncStorage blob
 * the foreground app wrote via `updateWidgetData`.
 *
 * We treat the cache as authoritative here. If the app hasn't run yet
 * (fresh install, widget added before signing in), `readWidgetData`
 * returns the friendly default that prompts the user to open the app.
 */
export async function widgetTaskHandler(
  props: WidgetTaskHandlerProps,
): Promise<void> {
  const { widgetAction, renderWidget } = props;

  try {
    const data = await readWidgetData();
    // Greeting depends on time-of-day, not on stored state — refresh on
    // every system tick so the header stays in sync without the app
    // having to wake up just for that.
    const fresh = { ...data, greeting: currentGreeting() };
    renderWidget(HomeWidget({ data: fresh }));
  } catch (err) {
    logger.warn(`widgetTaskHandler ${widgetAction} failed`, err);
  }
}
