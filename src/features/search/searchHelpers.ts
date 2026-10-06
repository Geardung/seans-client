/**
 * Pure search helpers (M4). No React/DOM — unit-testable.
 */

/** Debounce window for the search input, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Minimum normalized query length before a search request is issued. */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/**
 * Normalize a raw search box value:
 * trim edges, collapse internal whitespace runs to a single space.
 */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** True when the normalized query is long enough to hit the API. */
export function isSearchQueryReady(raw: string): boolean {
  return normalizeSearchQuery(raw).length >= SEARCH_MIN_QUERY_LENGTH;
}

/**
 * Decide what a search request should look like for a raw input value.
 * Returns null when the query is not ready (too short / empty).
 */
export function searchRequestFor(
  raw: string,
): { q: string } | null {
  const q = normalizeSearchQuery(raw);
  if (q.length < SEARCH_MIN_QUERY_LENGTH) return null;
  return { q };
}
