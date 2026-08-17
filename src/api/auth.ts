import { supabase } from "./supabase";
import { logger } from "@/lib/logger";

/**
 * Stable error codes the UI can translate. "network" covers every
 * connection-level failure (offline, DNS, paused backend) — supabase-js
 * surfaces those as AuthRetryableFetchError with status 0.
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "user_already_exists"
  | "weak_password"
  | "email_not_confirmed"
  | "rate_limit"
  | "network"
  | "unknown";

export type AuthResult =
  | { ok: true }
  | { ok: false; code: AuthErrorCode; error: string };

function toErrorCode(error: {
  code?: string;
  message: string;
  status?: number;
}): AuthErrorCode {
  if (error.status === 0 || /network request failed|failed to fetch/i.test(error.message)) {
    return "network";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "user_already_exists":
    case "email_exists":
      return "user_already_exists";
    case "weak_password":
      return "weak_password";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate_limit";
    default:
      return "unknown";
  }
}

function failure(
  context: string,
  error: { code?: string; message: string; status?: number },
): AuthResult {
  logger.warn(`${context} failed`, { code: error.code, msg: error.message });
  return { ok: false, code: toErrorCode(error), error: error.message };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return failure("signIn", error);
  } catch (err) {
    return failure("signIn", { message: String(err), status: 0 });
  }
  return { ok: true };
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) return failure("signUp", error);
  } catch (err) {
    return failure("signUp", { message: String(err), status: 0 });
  }
  // The project has `mailer_autoconfirm: true`, so signUp returns a session
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
    return { ok: false, code: "unknown", error: "Not signed in." };
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
    return { ok: false, code: "network", error: "Network error. Please try again." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("delete-account failed", res.status, body);
    return {
      ok: false,
      code: "unknown",
      error: "Couldn't delete account. Please try again or contact support.",
    };
  }

  // Server-side delete succeeded — the access token is now invalid. Sign
  // out locally to clear cached session/profile and trigger the auth gate.
  await signOut();
  return { ok: true };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) return failure("passwordReset", error);
  } catch (err) {
    return failure("passwordReset", { message: String(err), status: 0 });
  }
  return { ok: true };
}
