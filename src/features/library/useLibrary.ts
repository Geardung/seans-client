/**
 * Library loader (M6). One-shot GET /api/library + manual refresh.
 * Abort + unmount-safe; no polling (library changes come from tasks).
 */

import { useCallback, useEffect, useState } from "react";
import { fetchLibrary } from "../../api/endpoints";
import type { LibraryItem } from "../../api/types";

export type LibraryStatus = "loading" | "ready" | "error";

export type LibraryState = {
  items: LibraryItem[];
  status: LibraryStatus;
  error: string | null;
  refresh: () => void;
};

export function useLibrary(): LibraryState {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const list = await fetchLibrary(controller.signal);
        if (cancelled || controller.signal.aborted) return;
        setItems(list);
        setStatus("ready");
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setStatus("error");
        setError(
          cause instanceof Error ? cause.message : "Не удалось загрузить библиотеку",
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  return { items, status, error, refresh };
}
