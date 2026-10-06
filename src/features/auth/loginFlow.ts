/**
 * Pure helpers for the web OAuth login flow. No Tauri/DOM deps — unit-testable.
 *
 * Flow: client generates a one-time `state`, opens the site in the system
 * browser, and the site redirects back to `seans://auth/callback`
 * (or the loopback fallback) carrying `access_token` + `state`.
 * The callback is accepted only when `state` matches the pending value.
 */

/** Payload of the `seans:auth-callback` window event (in-memory only). */
export type AuthCallbackDetail = {
  accessToken: string | null;
  state: string | null;
};

declare global {
  interface WindowEventMap {
    "seans:auth-callback": CustomEvent<AuthCallbackDetail>;
    "seans:auth-required": Event;
  }
}

/** Site origin that hosts the login page. */
export const AUTH_SITE_URL = "https://seans.tedeshi.ru";

/** Primary redirect URI (custom scheme). */
export const DEFAULT_REDIRECT_URI = "seans://auth/callback";

/** One-time OAuth `state`: 32 random bytes as lowercase hex (64 chars). */
export function createOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Authorize URL: https://seans.tedeshi.ru/auth?redirect_uri=…&state=…
 * `redirect_uri` is percent-encoded (seans:// → seans%3A%2F%2F…).
 */
export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const url = new URL("/auth", AUTH_SITE_URL);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Loopback fallback redirect: http://127.0.0.1:{port}/callback */
export function loopbackRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}/callback`;
}

export type CallbackCheck =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "missing-token" | "missing-state" | "state-mismatch" };

/**
 * Validate a deep-link/loopback auth callback against the pending login state.
 * On any failure nothing may be stored by the caller.
 */
export function checkAuthCallback(
  pendingState: string | null | undefined,
  receivedState: string | null | undefined,
  accessToken: string | null | undefined,
): CallbackCheck {
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return { ok: false, reason: "missing-token" };
  }
  if (typeof receivedState !== "string" || receivedState.length === 0) {
    return { ok: false, reason: "missing-state" };
  }
  if (
    typeof pendingState !== "string" ||
    pendingState.length === 0 ||
    pendingState !== receivedState
  ) {
    return { ok: false, reason: "state-mismatch" };
  }
  return { ok: true, accessToken };
}
