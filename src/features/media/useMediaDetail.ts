/**
 * Media detail loader (M4): GET /api/media/{id} + GET /api/media/{id}/reviews.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchMedia, fetchMediaReviews } from "../../api/endpoints";
import type { MediaDetail, ReviewResponse } from "../../api/types";

export type MediaDetailStatus = "loading" | "ready" | "error";

export type MediaDetailState = {
  detail: MediaDetail | null;
  reviews: ReviewResponse[];
  status: MediaDetailStatus;
  reviewsStatus: MediaDetailStatus;
  error: string | null;
  reviewsError: string | null;
  refresh: () => void;
};

export function useMediaDetail(mediaId: string): MediaDetailState {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [status, setStatus] = useState<MediaDetailStatus>("loading");
  const [reviewsStatus, setReviewsStatus] = useState<MediaDetailStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setStatus("loading");
    setError(null);
    setDetail(null);

    void (async () => {
      try {
        const item = await fetchMedia(mediaId, controller.signal);
        if (cancelled || controller.signal.aborted) return;
        setDetail(item);
        setStatus("ready");
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить фильм");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mediaId, refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setReviewsStatus("loading");
    setReviewsError(null);

    void (async () => {
      try {
        const items = await fetchMediaReviews(mediaId, controller.signal);
        if (cancelled || controller.signal.aborted) return;
        setReviews(items);
        setReviewsStatus("ready");
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setReviewsStatus("error");
        setReviewsError(cause instanceof Error ? cause.message : "Не удалось загрузить отзывы");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mediaId, refreshToken]);

  return {
    detail,
    reviews,
    status,
    reviewsStatus,
    error,
    reviewsError,
    refresh,
  };
}
