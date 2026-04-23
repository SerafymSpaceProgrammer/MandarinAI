type HapticsModule = {
  impactAsync: (style: "light" | "medium" | "heavy") => Promise<void>;
  notificationAsync: (type: "success" | "warning" | "error") => Promise<void>;
  selectionAsync: () => Promise<void>;
};

let cached: HapticsModule | null | undefined;

function load(): HapticsModule | null {
  if (cached !== undefined) return cached;
  try {
    const mod = require("expo-haptics") as {
      impactAsync: (style: unknown) => Promise<void>;
      notificationAsync: (type: unknown) => Promise<void>;
      selectionAsync: () => Promise<void>;
      ImpactFeedbackStyle: { Light: unknown; Medium: unknown; Heavy: unknown };
      NotificationFeedbackType: { Success: unknown; Warning: unknown; Error: unknown };
    };
    cached = {
      impactAsync: (style) => {
        const map = {
          light: mod.ImpactFeedbackStyle.Light,
          medium: mod.ImpactFeedbackStyle.Medium,
          heavy: mod.ImpactFeedbackStyle.Heavy,
        } as const;
        return mod.impactAsync(map[style]);
      },
      notificationAsync: (type) => {
        const map = {
          success: mod.NotificationFeedbackType.Success,
          warning: mod.NotificationFeedbackType.Warning,
          error: mod.NotificationFeedbackType.Error,
        } as const;
        return mod.notificationAsync(map[type]);
      },
      selectionAsync: () => mod.selectionAsync(),
    };
  } catch {
    cached = null;
  }
  return cached;
}

export const haptics = {
  light: () => void load()?.impactAsync("light"),
  medium: () => void load()?.impactAsync("medium"),
  heavy: () => void load()?.impactAsync("heavy"),
  success: () => void load()?.notificationAsync("success"),
  warning: () => void load()?.notificationAsync("warning"),
  error: () => void load()?.notificationAsync("error"),
  selection: () => void load()?.selectionAsync(),
};
