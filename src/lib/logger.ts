type Level = "debug" | "info" | "warn" | "error";

const enabled = __DEV__;

function emit(level: Level, args: unknown[]) {
  if (!enabled && level !== "error") return;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[${level}]`, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
