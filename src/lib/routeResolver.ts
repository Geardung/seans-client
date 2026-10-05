import type { DeepLinkPayload } from "./deepLink";
import { parseDeepLink } from "./deepLink";

/** Hash route paths used by the shell. */
export const ROUTES = {
  home: "#/",
  login: "#/login",
  room: (code: string) => `#/room/${code}`,
} as const;

/**
 * Map a parsed deep-link payload to a hash route path.
 * Auth callback lands on home; the tokens themselves are handled separately
 * (emitted in memory only) and must not be persisted by routing code.
 */
export function resolveRoute(payload: DeepLinkPayload): string {
  switch (payload.kind) {
    case "home":
    case "authCallback":
      return ROUTES.home;
    case "room":
      return ROUTES.room(payload.roomCode);
  }
}

/** Parse a raw `seans://` URL and resolve the target hash route, or null if ignored. */
export function resolveRouteFromDeepLink(raw: string): string | null {
  const payload = parseDeepLink(raw);
  return payload ? resolveRoute(payload) : null;
}

/** Read the current hash route (e.g. `#/room/ABCD2345`). Always starts with `#/`. */
export function getCurrentHashRoute(): string {
  const hash = window.location.hash;
  return hash.length > 0 ? hash : ROUTES.home;
}

/** Extract the room code from a `#/room/{code}` hash route, if any. */
export function matchRoomRoute(hash: string): string | null {
  const m = /^#\/room\/([A-Z2-9]{8})$/.exec(hash);
  return m ? m[1] : null;
}
