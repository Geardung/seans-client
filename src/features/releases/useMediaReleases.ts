/**
 * Torrent releases loader (M5): GET /api/media/{id}/releases.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMediaReleases } from "../../api/endpoints";
import type { TorrentReleaseResponse } from "../../api/types";

export type ReleasesStatus = "loading" | "ready" | "error";

export type MediaReleasesState = {
  releases: TorrentReleaseResponse[];
  status: ReleasesStatus;
  error: string | null;
  refreshing: boolean;
  /** Reload from cache (refresh=false). */
  reload: () => void;
  /** Force a tracker re-scan (refresh=true). */
  refreshFromTrackers: () => void;
};

export function useMediaReleases(mediaId: string): MediaReleasesState {
  const [releases, setReleases] = useState<TorrentReleaseResponse[]>([]);
  const [status, setStatus] = useState<ReleasesStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** false = cached list, true = forced tracker refresh. */
  const [forceRefresh, setForceRefresh] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const releasesRef = useRef<TorrentReleaseResponse[]>([]);

  const reload = useCallback(() => {
    setForceRefresh(false);
    setReloadToken((token) => token + 1);
  }, []);

  const refreshFromTrackers = useCallback(() => {
    setForceRefresh(true);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    // Keep the previous table on screen while a tracker refresh is running;
    // only show the full-screen spinner on the first load / hard reload.
    setStatus((prev) => (prev === "ready" && releasesRef.current.length > 0 ? "ready" : "loading"));
    setError(null);
    if (forceRefresh) setRefreshing(true);

    void (async () => {
      try {
        const items = await fetchMediaReleases(mediaId, {
          refresh: forceRefresh,
          signal: controller.signal,
        });
        if (cancelled || controller.signal.aborted) return;
        releasesRef.current = items;
        setReleases(items);
        setStatus("ready");
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setStatus("error");
        setError(
          cause instanceof Error ? cause.message : "Не удалось загрузить релизы",
        );
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mediaId, forceRefresh, reloadToken]);

  return {
    releases,
    status,
    error,
    refreshing,
    reload,
    refreshFromTrackers,
  };
}
