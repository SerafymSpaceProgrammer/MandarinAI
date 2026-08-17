import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { STRINGS } from "@/i18n/strings";
import { logger } from "@/lib/logger";
import type { NativeLanguage, Profile } from "@/types";

/**
 * Daily study reminder. Onboarding collects `notification_enabled` +
 * `notification_time` — this module is the part that actually schedules
 * the local notification (requesting permission and never delivering
 * anything is an App Review rejection trigger).
 */

const REMINDER_ID = "daily-study-reminder";

// Show the banner even if the app happens to be foregrounded at reminder
// time — a silently swallowed notification reads as "reminders don't work".
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Reconcile the scheduled reminder with the profile. Safe to call on every
 * profile change: it cancels our previous schedule first, so edits to the
 * time (or disabling) never stack duplicates.
 */
export async function syncDailyReminder(profile: Profile | null): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});

    if (!profile?.notification_enabled || !profile.notification_time) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const [hh, mm] = profile.notification_time.split(":");
    const hour = Number(hh);
    const minute = Number(mm);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Daily reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const lang = (profile.native_language ?? "en") as NativeLanguage;
    const s = (STRINGS[lang] ?? STRINGS.en).reminders;

    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: s.title, body: s.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    logger.debug(`daily reminder scheduled at ${hour}:${minute}`);
  } catch (err) {
    logger.warn("syncDailyReminder failed", err);
  }
}
