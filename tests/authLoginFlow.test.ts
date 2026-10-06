import { describe, expect, it } from "vitest";
import {
  AUTH_SITE_URL,
  buildAuthorizeUrl,
  checkAuthCallback,
  createOAuthState,
  DEFAULT_REDIRECT_URI,
  loopbackRedirectUri,
} from "../src/features/auth/loginFlow";

describe("createOAuthState", () => {
  it("returns 32 random bytes as 64-char hex", () => {
    const state = createOAuthState();
    expect(state).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a fresh value every call", () => {
    const a = createOAuthState();
    const b = createOAuthState();
    expect(a).not.toBe(b);
  });
});

describe("buildAuthorizeUrl", () => {
  it("points at the Seans site /auth endpoint", () => {
    const url = new URL(buildAuthorizeUrl("abc", DEFAULT_REDIRECT_URI));
    expect(url.origin).toBe(AUTH_SITE_URL);
    expect(url.pathname).toBe("/auth");
  });

  it("percent-encodes the seans:// redirect_uri and passes state", () => {
    const raw = buildAuthorizeUrl("abc123", DEFAULT_REDIRECT_URI);
    expect(raw).toContain("redirect_uri=seans%3A%2F%2Fauth%2Fcallback");
    expect(raw).toContain("state=abc123");
    expect(new URL(raw).searchParams.get("state")).toBe("abc123");
  });

  it("supports the loopback fallback redirect", () => {
    const raw = buildAuthorizeUrl("st", loopbackRedirectUri(45678));
    expect(new URL(raw).searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:45678/callback",
    );
  });
});

describe("loopbackRedirectUri", () => {
  it("builds http://127.0.0.1:<port>/callback", () => {
    expect(loopbackRedirectUri(1234)).toBe("http://127.0.0.1:1234/callback");
  });
});

describe("checkAuthCallback", () => {
  const pending = "pending-state-1";

  it("accepts a matching state and non-empty token", () => {
    const result = checkAuthCallback(pending, pending, "jwt-token");
    expect(result).toEqual({ ok: true, accessToken: "jwt-token" });
  });

  it("rejects a mismatching state and stores nothing", () => {
    expect(checkAuthCallback(pending, "other-state", "jwt-token")).toEqual({
      ok: false,
      reason: "state-mismatch",
    });
  });

  it("rejects when there is no pending login (state cannot match)", () => {
    expect(checkAuthCallback(null, pending, "jwt-token")).toEqual({
      ok: false,
      reason: "state-mismatch",
    });
    expect(checkAuthCallback(undefined, pending, "jwt-token")).toEqual({
      ok: false,
      reason: "state-mismatch",
    });
    expect(checkAuthCallback("", pending, "jwt-token")).toEqual({
      ok: false,
      reason: "state-mismatch",
    });
  });

  it("rejects a missing or empty token", () => {
    expect(checkAuthCallback(pending, pending, null)).toEqual({
      ok: false,
      reason: "missing-token",
    });
    expect(checkAuthCallback(pending, pending, "")).toEqual({
      ok: false,
      reason: "missing-token",
    });
  });

  it("rejects a missing or empty received state", () => {
    expect(checkAuthCallback(pending, null, "jwt-token")).toEqual({
      ok: false,
      reason: "missing-state",
    });
    expect(checkAuthCallback(pending, "", "jwt-token")).toEqual({
      ok: false,
      reason: "missing-state",
    });
  });

  it("requires both sides to be non-empty strings for a match", () => {
    // Empty received state is missing-state (not a mismatch of two real values).
    expect(checkAuthCallback("", "", "jwt-token")).toEqual({
      ok: false,
      reason: "missing-state",
    });
    expect(checkAuthCallback(pending, pending, "x")).toEqual({
      ok: true,
      accessToken: "x",
    });
  });
});
