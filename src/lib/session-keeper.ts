import { supabase } from "@/integrations/supabase/client";
import { trace } from "@/lib/debug-log";

/**
 * Keeps paired Fire Sticks signed in: a network hiccup never counts as
 * signed out, and the Fire TV app holds a private backup of the sign-in.
 */

interface AuthBackupBridge {
  saveAuthBackup?: (value: string) => void;
  readAuthBackup?: () => string;
  clearAuthBackup?: () => void;
}

function bridge(): AuthBackupBridge | null {
  if (typeof window === "undefined") return null;
  return (window.StreamDeckNative as unknown as AuthBackupBridge | undefined) ?? null;
}

/** True only when the server clearly rejected the sign-in (not a connection failure). */
export function isAuthRejection(error: { status?: number | undefined; code?: string | undefined; name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (["session_not_found", "refresh_token_not_found", "refresh_token_already_used", "user_not_found", "bad_jwt", "session_expired"].includes(code)) return true;
  if (error.name === "AuthRetryableFetchError") return false;
  const status = error.status ?? 0;
  return status === 401 || status === 403;
}

export function saveAuthBackup(session: { access_token: string; refresh_token: string } | null) {
  const b = bridge();
  if (!session || typeof b?.saveAuthBackup !== "function") return;
  try {
    b.saveAuthBackup(JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
  } catch {
    /* ignore */
  }
}

export function clearAuthBackup() {
  try {
    bridge()?.clearAuthBackup?.();
  } catch {
    /* ignore */
  }
}

let restoring: Promise<void> | null = null;

/** If the web view lost its sign-in, restore the Fire TV app's backup copy. */
export function restoreFromBackup(): Promise<void> {
  if (restoring) return restoring;
  restoring = (async () => {
    const b = bridge();
    if (typeof b?.readAuthBackup !== "function") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    let saved: { access_token?: string; refresh_token?: string } | null = null;
    try {
      saved = JSON.parse(b.readAuthBackup() || "null");
    } catch {
      saved = null;
    }
    if (!saved?.refresh_token || !saved.access_token) return;
    const { error } = await supabase.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
    if (error) {
      trace("Sign-in backup restore failed", error.message);
      if (isAuthRejection(error)) clearAuthBackup();
    } else trace("Sign-in restored from Fire TV backup");
  })().finally(() => {
    restoring = null;
  });
  return restoring;
}

let refreshing: Promise<unknown> | null = null;

/** One sign-in renewal at a time, so two renewals can't cancel each other out. */
export function refreshOnce() {
  if (refreshing) return refreshing;
  refreshing = supabase.auth
    .getSession()
    .then(({ data }) => (data.session ? supabase.auth.refreshSession() : null))
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Verifies the sign-in with the server in the background; signs out only on a clear rejection. */
export async function verifyInBackground(onRejected: () => void) {
  try {
    const { error } = await supabase.auth.getUser();
    if (!error) return;
    if (isAuthRejection(error)) {
      trace("Signed out: server refused the sign-in", error.message);
      clearAuthBackup();
      onRejected();
    } else trace("Sign-in check skipped: no connection", error.message);
  } catch (e) {
    trace("Sign-in check skipped: no connection", String(e));
  }
}
