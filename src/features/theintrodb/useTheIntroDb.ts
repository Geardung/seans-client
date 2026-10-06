/**
 * TheIntroDB loader hook (M8). Resolves media context for a task file,
 * then loads segments. Silently disabled when tmdb_id is missing.
 */

import { useEffect, useState } from "react";
import {
  fetchLibrary,
  fetchMedia,
  fetchMediaReviews,
} from "../../api/endpoints";
import type { ApiId, MediaDetail, ReviewResponse } from "../../api/types";
import { useAuth } from "../auth";
import { resolveOwnReview } from "../reviews/reviewHelpers";
import { fetchSegments } from "./theintrodbApi";
import { emptyBundle, type TheIntroDbBundle } from "./types";

export type TheIntroDbContext = {
  mediaId: ApiId;
  tmdbId: number | null;
  season: number | null;
  episode: number | null;
  detail: MediaDetail | null;
  /** True when the user already left a review (popup is skipped). */
  alreadyReviewed: boolean;
};

export type TheIntroDbState = {
  /** Empty bundle while loading or when the feature is off. */
  segments: TheIntroDbBundle;
  context: TheIntroDbContext | null;
  /** True once a non-empty segments fetch finished (or was skipped). */
  ready: boolean;
};

const EMPTY_STATE: TheIntroDbState = {
  segments: emptyBundle(),
  context: null,
  ready: false,
};

/**
 * Find the library file → media id + season/episode for a task file id.
 * Returns null when the file is unknown (feature stays off).
 */
async function resolveFileContext(
  fileId: string,
): Promise<{ mediaId: ApiId; season: number | null; episode: number | null } | null> {
  const items = await fetchLibrary();
  for (const item of items) {
    for (const file of item.files) {
      if (String(file.id) === String(fileId)) {
        return {
          mediaId: item.media_item.id,
          season: file.season ?? null,
          episode: file.episode ?? null,
        };
      }
    }
  }
  return null;
}

function toOptInt(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}

/**
 * Load TheIntroDB segments for the media behind `fileId`.
 * Empty segments = feature off (null tmdb_id, fetch error, unknown file).
 */
export function useTheIntroDb(fileId: string): TheIntroDbState {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<TheIntroDbState>(EMPTY_STATE);

  useEffect(() => {
    if (!fileId) {
      setState(EMPTY_STATE);
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const fileCtx = await resolveFileContext(fileId);
        if (cancelled) return;
        if (!fileCtx) {
          setState({ segments: emptyBundle(), context: null, ready: true });
          return;
        }

        const detail = await fetchMedia(fileCtx.mediaId);
        if (cancelled) return;

        // Own review: MediaDetail.user_review, else match reviews by user id.
        let alreadyReviewed = Boolean(detail.user_review);
        if (!alreadyReviewed && userId != null) {
          try {
            const reviews: ReviewResponse[] = await fetchMediaReviews(
              fileCtx.mediaId,
            );
            alreadyReviewed =
              resolveOwnReview(detail, reviews, userId) != null;
          } catch {
            alreadyReviewed = Boolean(detail.user_review);
          }
        }

        const tmdbId =
          typeof detail.tmdb_id === "number" && Number.isFinite(detail.tmdb_id)
            ? detail.tmdb_id
            : null;

        const context: TheIntroDbContext = {
          mediaId: fileCtx.mediaId,
          tmdbId,
          season: toOptInt(fileCtx.season),
          episode: toOptInt(fileCtx.episode),
          detail,
          alreadyReviewed,
        };

        if (tmdbId == null) {
          // Silent-off: MediaDetail.tmdb_id is null.
          setState({ segments: emptyBundle(), context, ready: true });
          return;
        }

        const segments = await fetchSegments({
          tmdbId,
          season: context.season,
          episode: context.episode,
        });
        if (cancelled) return;
        setState({ segments, context, ready: true });
      } catch (cause) {
        if (cancelled) return;
        console.debug("[theintrodb] disabled", fileId, cause);
        setState({ segments: emptyBundle(), context: null, ready: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, userId]);

  return state;
}
