/**
 * Typed Seans API client placeholder (M1).
 *
 * Base URL: https://api.seans.tedeshi.ru
 * Auth: Authorization: Bearer <JWT> (storage is M2 — keyring / Credential Manager).
 *
 * Do not add worker/torrent endpoints here: this client never calls them.
 */

export const API_BASE_URL = "https://api.seans.tedeshi.ru";

export type ApiError = {
  status: number;
  message: string;
};

/** Placeholder — real request helpers land with auth (M2) and search (M4). */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
