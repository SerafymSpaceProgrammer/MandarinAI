import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { logger } from "./logger";

/**
 * RevenueCat client wrapper. We use RC as the bridge between Apple/Google
 * IAP and our Supabase `profiles.tier` column — RC handles the storefront
 * differences, billing receipts, restore flow, and fires a webhook into
 * our edge function on every purchase/renewal/cancellation event.
 *
 * Native-module gotcha: react-native-purchases is a native module and is
 * NOT shipped inside Expo Go. We use `require()` instead of a static
 * import so the module is only loaded when running in a dev-client or a
 * standalone build. In Expo Go, every call here turns into a safe no-op,
 * which lets the rest of the app keep working while testing locally.
 */

let initialized = false;
let unsupported = false;
// Cached reference to the native module — only available outside Expo Go.
type PurchasesModule = typeof import("react-native-purchases");
let RC: PurchasesModule | null = null;

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const PRO_ENTITLEMENT_ID = "pro";

function loadPurchasesModule(): PurchasesModule | null {
  if (unsupported) return null;
  if (RC) return RC;
  // Expo Go ships a fixed bundle of native modules; everything else trips
  // a TurboModule crash on import. Bail out before we touch the require.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    logger.info("Skipping RevenueCat in Expo Go — purchases will be a no-op");
    unsupported = true;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RC = require("react-native-purchases") as PurchasesModule;
    return RC;
  } catch (err) {
    logger.warn("react-native-purchases not available — running in no-op mode", err);
    unsupported = true;
    return null;
  }
}

/**
 * Configure the SDK with the platform-specific public key. Safe to call on
 * every app boot — the SDK no-ops if already configured. Anonymous calls
 * are allowed; we'll re-identify with the Supabase user id once the auth
 * session arrives so RC ties purchases to the right user.
 */
export async function initRevenueCat(): Promise<void> {
  if (initialized) return;
  const mod = loadPurchasesModule();
  if (!mod) return;
  const key = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
  if (!key) {
    logger.warn(
      "RevenueCat key missing in .env — IAP will be unavailable until EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY are set",
    );
    return;
  }
  try {
    if (__DEV__) {
      await mod.default.setLogLevel(mod.LOG_LEVEL.WARN);
    }
    mod.default.configure({ apiKey: key });
    initialized = true;
    logger.info(`RevenueCat configured (${Platform.OS}, build ${Constants.expoConfig?.version ?? "?"})`);
  } catch (err) {
    logger.warn("RevenueCat configure error", err);
  }
}

/**
 * Tie the current RC instance to our Supabase user id. Call after sign-in
 * and again when the auth state changes. RC dedupes — multiple identifies
 * with the same id are no-ops.
 */
export async function identifyRevenueCat(userId: string): Promise<void> {
  if (!initialized) return;
  const mod = loadPurchasesModule();
  if (!mod) return;
  try {
    await mod.default.logIn(userId);
  } catch (err) {
    logger.warn("RevenueCat logIn error", err);
  }
}

/** Call on sign-out so RC stops attaching purchases to the previous user. */
export async function unidentifyRevenueCat(): Promise<void> {
  if (!initialized) return;
  const mod = loadPurchasesModule();
  if (!mod) return;
  try {
    await mod.default.logOut();
  } catch {
    /* RC throws if already anonymous — fine */
  }
}

export function isRevenueCatReady(): boolean {
  return initialized;
}

/** Internal accessor used by `subscription.ts` to call the native SDK. */
export function getPurchasesModule(): PurchasesModule | null {
  return loadPurchasesModule();
}
