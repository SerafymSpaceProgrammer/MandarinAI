// revenuecat-webhook — Supabase edge function
//
// Receives subscription events from RevenueCat and mirrors them onto the
// shared `profiles` table so that both MandarinAI (mobile) and ChineseLens
// (extension) see the same Pro/lifetime status without ever talking to
// Apple or Google directly.
//
// Auth: RevenueCat sends an `Authorization` header equal to whatever we
// set as the webhook secret in the RC dashboard. We compare in constant
// time. Deploy with `--no-verify-jwt` so Supabase's gateway doesn't reject
// the unauthenticated request before we get to verify it ourselves.
//
// Event reference: https://www.revenuecat.com/docs/webhooks

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;
const PRO_ENTITLEMENT = Deno.env.get("REVENUECAT_PRO_ENTITLEMENT") ?? "pro";
const LIFETIME_PRODUCT_ID =
  Deno.env.get("REVENUECAT_LIFETIME_PRODUCT_ID") ?? "mandarinai.pro.lifetime";

// ──────────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

/** Constant-time string comparison to prevent timing attacks on the secret. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * PATCH a row in `public.profiles` using the service role. Bypasses RLS —
 * only edge functions deployed with the service key should ever import
 * this. Returns false on transport errors so the caller can decide whether
 * to ack the webhook (LemonSqueezy/RC will retry on non-2xx).
 */
async function patchProfile(
  userId: string,
  fields: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(fields),
    },
  );
  if (!res.ok) {
    console.error("patchProfile failed", res.status, await res.text());
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────────────
// RevenueCat event shape (only the parts we use)
// ──────────────────────────────────────────────────────────────────────────
interface RCEvent {
  event: {
    type: string;
    app_user_id: string; // we set this to the Supabase user id via Purchases.logIn
    original_app_user_id?: string;
    product_id?: string;
    period_type?: "TRIAL" | "NORMAL" | "INTRO";
    expiration_at_ms?: number | null;
    entitlement_ids?: string[];
    entitlement_id?: string;
    cancel_reason?: string | null;
    new_product_id?: string;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // RevenueCat sends `Authorization: Bearer <secret>` (the value you set in
  // the RC dashboard webhook config). We compare against our shared secret.
  const auth = req.headers.get("Authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!SHARED_SECRET || !safeEqual(provided, SHARED_SECRET)) {
    console.warn("rc-webhook: bad auth", { hasHeader: !!auth });
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let payload: RCEvent;
  try {
    payload = (await req.json()) as RCEvent;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const ev = payload.event;
  if (!ev || !ev.type || !ev.app_user_id) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  // RC's `app_user_id` is whatever we passed to `Purchases.logIn()` —
  // by convention we set it to the Supabase user id. Sanity-check the
  // shape so a misconfigured client doesn't poison our profiles table.
  const userId = ev.app_user_id;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    console.warn("rc-webhook: non-uuid app_user_id, ignoring", { userId });
    return jsonResponse({ ok: true, ignored: "non_uuid_user_id" });
  }

  const handled = await handle(ev, userId);
  return jsonResponse({ ok: true, handled });
});

/**
 * Map an RC event to a profiles patch. We mirror the schema the LemonSqueezy
 * webhook used so the ChineseLens extension's existing tier-reading code
 * works unchanged — just the writer is different.
 */
async function handle(ev: RCEvent["event"], userId: string): Promise<string> {
  const isLifetime = ev.product_id === LIFETIME_PRODUCT_ID;
  const entitlementIds = ev.entitlement_ids ?? (ev.entitlement_id ? [ev.entitlement_id] : []);
  const hasPro = entitlementIds.includes(PRO_ENTITLEMENT);
  const periodEnd = ev.expiration_at_ms
    ? new Date(ev.expiration_at_ms).toISOString()
    : null;

  switch (ev.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "TRANSFER": {
      if (isLifetime) {
        await patchProfile(userId, {
          tier: "lifetime",
          status: "active",
          current_period_end: null,
          ls_subscription_id: null,
          ls_variant_id: ev.product_id ?? null,
        });
      } else if (hasPro) {
        await patchProfile(userId, {
          tier: "pro",
          status: ev.period_type === "TRIAL" ? "on_trial" : "active",
          current_period_end: periodEnd,
          ls_variant_id: ev.product_id ?? null,
        });
      }
      return ev.type;
    }

    case "CANCELLATION": {
      // User opted not to renew — they keep Pro access until the period ends.
      // The EXPIRATION event will flip the tier when access actually runs out.
      await patchProfile(userId, {
        status: "cancelled",
        current_period_end: periodEnd,
      });
      return ev.type;
    }

    case "EXPIRATION": {
      // Lifetime purchases never expire — protect against a stray event.
      if (isLifetime) return `${ev.type}:lifetime_ignored`;
      await patchProfile(userId, {
        tier: "free",
        status: "expired",
        current_period_end: null,
      });
      return ev.type;
    }

    case "BILLING_ISSUE": {
      // Grace period — don't drop the tier yet, just flag the status so the
      // UI can show a "fix your payment method" banner.
      await patchProfile(userId, { status: "past_due" });
      return ev.type;
    }

    case "NON_RENEWING_PURCHASE": {
      // Lifetime (or any other one-time IAP) — promote to lifetime tier.
      if (isLifetime) {
        await patchProfile(userId, {
          tier: "lifetime",
          status: "active",
          current_period_end: null,
          ls_variant_id: ev.product_id ?? null,
        });
      }
      return ev.type;
    }

    case "SUBSCRIBER_ALIAS":
    case "TEST":
    default:
      return `ignored:${ev.type}`;
  }
}
