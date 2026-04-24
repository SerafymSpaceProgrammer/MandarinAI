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
 * Delete the current account.
 *
 * Supabase doesn't expose user self-deletion on the client by design.
 * Until we add a `delete-account` edge function that uses service-role to
 * call `auth.admin.deleteUser()`, we sign the user out and surface a TODO.
 */
export async function deleteAccount(): Promise<AuthResult> {
  // TODO: Phase 1.7 — implement /functions/delete-account edge function.
  await signOut();
  return {
    ok: false,
    error:
      "Account deletion isn't wired up yet. Please email support to remove your account.",
  };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  return { ok: true };
}
