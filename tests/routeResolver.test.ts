import { describe, expect, it } from "vitest";
import { parseDeepLink } from "../src/lib/deepLink";
import {
  matchRoomRoute,
  resolveRoute,
  resolveRouteFromDeepLink,
  ROUTES,
} from "../src/lib/routeResolver";

describe("resolveRoute", () => {
  it("maps home payload to #/", () => {
    expect(resolveRoute({ kind: "home" })).toBe(ROUTES.home);
  });

  it("maps auth callback payload to home (tokens handled separately)", () => {
    expect(
      resolveRoute({
        kind: "authCallback",
        accessToken: "tok",
        state: "st",
      }),
    ).toBe(ROUTES.home);
  });

  it("maps room payload to #/room/:code", () => {
    expect(resolveRoute({ kind: "room", roomCode: "ABCD2345" })).toBe(
      "#/room/ABCD2345",
    );
  });
});

describe("resolveRouteFromDeepLink", () => {
  it("resolves seans:// to home", () => {
    expect(resolveRouteFromDeepLink("seans://")).toBe("#/");
  });

  it("resolves auth callback to home", () => {
    expect(
      resolveRouteFromDeepLink("seans://auth/callback?access_token=a&state=b"),
    ).toBe("#/");
  });

  it("resolves room links", () => {
    expect(resolveRouteFromDeepLink("seans://room/ABCD2345")).toBe(
      "#/room/ABCD2345",
    );
  });

  it("returns null for ignored links (no navigation)", () => {
    expect(resolveRouteFromDeepLink("seans://room/bad")).toBeNull();
    expect(resolveRouteFromDeepLink("seans://nope")).toBeNull();
    expect(resolveRouteFromDeepLink("garbage")).toBeNull();
  });

  it("round-trips with parseDeepLink", () => {
    const raw = "seans://room/ZZZZ2222";
    const payload = parseDeepLink(raw);
    expect(payload).not.toBeNull();
    if (payload) {
      expect(resolveRoute(payload)).toBe("#/room/ZZZZ2222");
    }
  });
});

describe("matchRoomRoute", () => {
  it("extracts a valid room code from a hash route", () => {
    expect(matchRoomRoute("#/room/ABCD2345")).toBe("ABCD2345");
  });

  it("returns null for non-room or invalid routes", () => {
    expect(matchRoomRoute("#/")).toBeNull();
    expect(matchRoomRoute("#/login")).toBeNull();
    expect(matchRoomRoute("#/room/bad")).toBeNull();
    expect(matchRoomRoute("#/room/ABCD2345/extra")).toBeNull();
  });
});
