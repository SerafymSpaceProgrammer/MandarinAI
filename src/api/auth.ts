import { supabase } from "./supabase";
import { logger } from "@/lib/logger";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Translate a Supabase auth error code into a user-facing message.
 * Keep it short — the UI layer adds the emoji / formatting.
 */
function humanizeError(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  const map: Record<string, string> = {
    invalid_credentials: "Invalid email or password.",
    user_already_exists: "An account with this email already exists.",
    weak_password: "Password is too weak — use at least 6 characters.",
    email_not_confirmed: "Please confirm your email first.",
    over_email_send_rate_limit: "Too many attempts. Try again in a minute.",
    signup_disabled: "Sign-up is currently disabled.",
  };
  return map[code] ?? fallback;
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    logger.warn("signIn failed", { code: error.code, msg: error.message });
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  return { ok: true };
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) {
    logger.warn("signUp failed", { code: error.code, msg: error.message });
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  // The extension has `mailer_autoconfirm: true`, so signUp returns a session
  // immediately and onAuthStateChange will fire. Nothing else to do here.
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    logger.warn("signOut error", error.message);
  }
}

/**
 * Delete the current account end-to-end via the `delete-account` edge
 * function. Required for Apple App Review (Guideline 5.1.1(v)). The
 * edge function purges public-schema data and then calls
 * auth.admin.deleteUser; we sign out locally on success so the
 * onAuthStateChange listener routes the user back to the auth screens.
 */
export async function deleteAccount(): Promise<AuthResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) {
    return { ok: false, error: "Not signed in." };
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
    });
  } catch (err) {
    logger.warn("delete-account fetch error", err);
    return { ok: false, error: "Network error. Please try again." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("delete-account failed", res.status, body);
    return {
      ok: false,
      error: "Couldn't delete account. Please try again or contact support.",
    };
  }

  // Server-side delete succeeded — the access token is now invalid. Sign
  // out locally to clear cached session/profile and trigger the auth gate.
  await signOut();
  return { ok: true };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  return { ok: true };
}
