/**
 * Debounced media search hook (M4).
 *
 * - Debounces input by SEARCH_DEBOUNCE_MS.
 * - Skips requests until the normalized query is at least
 *   SEARCH_MIN_QUERY_LENGTH characters.
 * - Aborts the in-flight request whenever the query changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { searchMedia } from "../../api/endpoints";
import type { MediaSearchResult } from "../../api/types";
import { isSearchQueryReady, normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from "./searchHelpers";

export type MediaSearchStatus = "idle" | "loading" | "ready" | "error";

export type MediaSearchState = {
  query: string;
  results: MediaSearchResult[];
  status: MediaSearchStatus;
  error: string | null;
  setQuery: (value: string) => void;
  retry: () => void;
};

export function useMediaSearch(): MediaSearchState {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [status, setStatus] = useState<MediaSearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Keep the latest query string available to the fetch closure.
  const queryRef = useRef(query);
  queryRef.current = query;

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const normalized = normalizeSearchQuery(queryRef.current);

    if (!isSearchQueryReady(normalized)) {
      setResults([]);
      setStatus("idle");
      setError(null);
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const items = await searchMedia(normalized, controller.signal);
          if (controller.signal.aborted) return;
          setResults(items);
          setStatus("ready");
          setError(null);
        } catch (cause) {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus("error");
          setError(cause instanceof Error ? cause.message : "Не удалось выполнить поиск");
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryToken]);

  return { query, results, status, error, setQuery, retry };
}
