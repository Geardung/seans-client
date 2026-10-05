import { useEffect, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { parseDeepLink } from "./lib/deepLink";
import {
  getCurrentHashRoute,
  matchRoomRoute,
  resolveRoute,
} from "./lib/routeResolver";

/** In-memory only token relay. Tokens must never be written to disk/localStorage in M1. */
export type AuthCallbackDetail = {
  accessToken: string | null;
  state: string | null;
};

declare global {
  interface WindowEventMap {
    "seans:auth-callback": CustomEvent<AuthCallbackDetail>;
  }
}

function emitAuthCallback(detail: AuthCallbackDetail): void {
  window.dispatchEvent(
    new CustomEvent<AuthCallbackDetail>("seans:auth-callback", { detail }),
  );
}

function navigate(hash: string): void {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

function handleDeepLinkUrl(raw: string): void {
  const payload = parseDeepLink(raw);
  if (!payload) return; // malformed / unknown — ignore, no crash

  if (payload.kind === "authCallback") {
    emitAuthCallback({
      accessToken: payload.accessToken,
      state: payload.state,
    });
  }

  navigate(resolveRoute(payload));
}

function useHashRoute(): string {
  const [route, setRoute] = useState(getCurrentHashRoute);

  useEffect(() => {
    const onChange = () => setRoute(getCurrentHashRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

/**
 * Minimal hash router:
 *   #/            home
 *   #/login       auth gate
 *   #/room/:code  room placeholder
 * Anything else renders home.
 */
function Router() {
  const route = useHashRoute();

  if (route === "#/login") return <LoginScreen />;

  const roomCode = matchRoomRoute(route);
  if (roomCode) return <RoomScreen code={roomCode} />;

  return <HomeScreen />;
}

export default function App() {
  useEffect(() => {
    // Deep links delivered while the app is running (Tauri deep-link plugin).
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { getCurrent, onOpenUrl } = await import(
          "@tauri-apps/plugin-deep-link"
        );

        // Cold start: URLs that launched the app are captured before JS mounts.
        const startupUrls = await getCurrent();
        if (startupUrls) {
          for (const url of startupUrls) handleDeepLinkUrl(url);
        }

        // Warm path: URLs delivered while the app is already running.
        const stop = await onOpenUrl((urls) => {
          for (const url of urls) handleDeepLinkUrl(url);
        });
        if (cancelled) stop();
        else unlisten = stop;
      } catch {
        // Running in a plain browser (npm run dev) — deep links unavailable.
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div className="app">
      <Router />
    </div>
  );
}

export { handleDeepLinkUrl };
