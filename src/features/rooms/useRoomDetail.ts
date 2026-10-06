/**
 * Room detail loader (M10): GET /api/rooms/{code} for join / deep links.
 * Abort + unmount-safe; one-shot per code.
 */

import { useEffect, useState } from "react";
import { fetchRoom } from "../../api/endpoints";
import { isApiError } from "../../api/client";
import type { RoomDetailResponse } from "../../api/types";

export type RoomDetailStatus = "loading" | "ready" | "error";

export type RoomDetailState = {
  detail: RoomDetailResponse | null;
  status: RoomDetailStatus;
  error: string | null;
  /** True when the API answered 404 for this code. */
  notFound: boolean;
};

export function useRoomDetail(
  code: string,
  enabled = true,
  reloadToken = 0,
): RoomDetailState {
  const [detail, setDetail] = useState<RoomDetailResponse | null>(null);
  const [status, setStatus] = useState<RoomDetailStatus>(
    enabled ? "loading" : "ready",
  );
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!enabled || !code) {
      setStatus("ready");
      return;
    }
    const controller = new AbortController();
    let cancelled = false;

    setStatus("loading");
    setError(null);
    setNotFound(false);

    void (async () => {
      try {
        const result = await fetchRoom(code, controller.signal);
        if (cancelled || controller.signal.aborted) return;
        setDetail(result);
        setStatus("ready");
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        if (isApiError(cause) && cause.status === 404) {
          setNotFound(true);
          setError("Комната не найдена");
        } else {
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось загрузить комнату",
          );
        }
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [code, enabled, reloadToken]);

  return { detail, status, error, notFound };
}
