import { Linking, Platform } from "react-native";
import type {
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

import { logger } from "@/lib/logger";
import { PRO_ENTITLEMENT_ID, getPurchasesModule } from "@/lib/revenuecat";
import type { Profile } from "@/types";

export type Plan = "monthly" | "yearly" | "lifetime";

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

/**
 * Whether the user has any active paid access. Treats `tier === 'pro'` or
 * `'lifetime'` as Pro. The shared Supabase `profiles.tier` column is the
 * source of truth — it's set by the RevenueCat webhook on every purchase /
 * renewal / cancellation event, so both the mobile app and the ChineseLens
 * extension always see the same status.
 */
export function isPro(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return profile.tier === "pro" || profile.tier === "lifetime";
}

export function isLifetime(profile: Profile | null | undefined): boolean {
  return profile?.tier === "lifetime";
}

/** Product identifiers as registered in App Store Connect and Google Play. */
export const PRODUCT_IDS: Record<Plan, string> = {
  monthly: "mandarinai.pro.monthly",
  yearly: "mandarinai.pro.yearly",
  lifetime: "mandarinai.pro.lifetime",
};

/** Fallback display prices — overridden by RevenueCat offerings when available. */
export const FALLBACK_PRICE: Record<Plan, string> = {
  monthly: "$4.99",
  yearly: "$39.99",
  lifetime: "$89.99",
};

export type PlanPackages = {
  monthly: PurchasesPackage | null;
  yearly: PurchasesPackage | null;
  lifetime: PurchasesPackage | null;
};

/**
 * Pull the "default" offering from RevenueCat and split it into named
 * packages we can wire to UI buttons. Returns nulls when running in Expo
 * Go (RC native module absent) — the UI shows hardcoded fallback prices
 * in that case and the purchase button returns a "not_supported" error.
 */
export async function fetchOfferings(): Promise<{
  offering: PurchasesOffering | null;
  packages: PlanPackages;
}> {
  const mod = getPurchasesModule();
  if (!mod) return { offering: null, packages: emptyPackages() };
  try {
    const offerings = await mod.default.getOfferings();
    const offering = offerings.current;
    if (!offering) return { offering: null, packages: emptyPackages() };

    const monthly = offering.monthly ?? findByProductId(offering, PRODUCT_IDS.monthly);
    const yearly = offering.annual ?? findByProductId(offering, PRODUCT_IDS.yearly);
    const lifetime =
      offering.lifetime ?? findByProductId(offering, PRODUCT_IDS.lifetime);

    return { offering, packages: { monthly, yearly, lifetime } };
  } catch (err) {
    logger.warn("fetchOfferings error", err);
    return { offering: null, packages: emptyPackages() };
  }
}

function emptyPackages(): PlanPackages {
  return { monthly: null, yearly: null, lifetime: null };
}

function findByProductId(
  offering: PurchasesOffering,
  productId: string,
): PurchasesPackage | null {
  return (
    offering.availablePackages.find((p) => p.product.identifier === productId) ??
    null
  );
}

/**
 * Open the platform's native IAP sheet for the given package. Apple/Google
 * handle the payment UI; RevenueCat tracks the receipt and fires our
 * webhook within seconds, which updates `profiles.tier` and lets the UI
 * reflect Pro status. Re-fetching the profile after this returns is enough
 * to surface the new tier.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  const mod = getPurchasesModule();
  if (!mod) return { ok: false, error: "not_supported" };
  try {
    const result = await mod.default.purchasePackage(pkg);
    const isPro = !!result.customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
    if (isPro) return { ok: true };
    // Receipt accepted but entitlement not granted (rare — e.g. RC config drift).
    return { ok: false, error: "entitlement_not_granted" };
  } catch (err: unknown) {
    if (typeof err === "object" && err && "userCancelled" in err && err.userCancelled) {
      return { ok: false, cancelled: true };
    }
    logger.warn("purchasePackage error", err);
    return {
      ok: false,
      error: extractErrorMessage(err),
    };
  }
}

/**
 * Apple App Review explicitly requires a Restore Purchases button on any
 * paid app. Calls into RC, which pulls the App Store / Play account's
 * receipts and re-grants entitlements; the webhook then writes profiles.tier.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  const mod = getPurchasesModule();
  if (!mod) return { ok: false, error: "not_supported" };
  try {
    const info = await mod.default.restorePurchases();
    const isPro = !!info.entitlements.active[PRO_ENTITLEMENT_ID];
    if (isPro) return { ok: true };
    return { ok: false, error: "no_active_purchase" };
  } catch (err: unknown) {
    logger.warn("restorePurchases error", err);
    return { ok: false, error: extractErrorMessage(err) };
  }
}

/**
 * Apple/Google don't provide an in-app cancellation flow — they require
 * us to deep-link out to the platform's subscription management page.
 * Opening this URL on iOS lands in Settings → Apple ID → Subscriptions;
 * on Android it lands in Play Store → Subscriptions.
 */
export async function openManageSubscriptions(): Promise<void> {
  const url =
    Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
  try {
    await Linking.openURL(url);
  } catch (err) {
    logger.warn("openManageSubscriptions error", err);
  }
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "purchase_failed";
}
