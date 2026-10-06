/**
 * Pure TheIntroDB segment helpers (M8). No React/DOM/fetch — unit-testable.
 *
 * Window semantics (contract):
 *   intro.start_ms null  → start of file (0)
 *   recap.start_ms null  → start of file (0)
 *   credits.end_ms null  → to EOF (+inf)
 *   preview.end_ms null  → to EOF (+inf)
 * Active window is half-open: [start ?? 0, end ?? +inf).
 */

import type {
  SegmentMarker,
  TheIntroDbBundle,
  TheIntroDbSegment,
  TheIntroDbSegmentType,
} from "./types";
import { emptyBundle, SEGMENT_TYPES, segmentLabel } from "./types";

function finiteOr(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolveList(
  segments: TheIntroDbBundle | readonly TheIntroDbSegment[] | null | undefined,
  type: TheIntroDbSegmentType,
): readonly TheIntroDbSegment[] {
  if (!segments) return [];
  if (Array.isArray(segments)) return segments as readonly TheIntroDbSegment[];
  return (segments as TheIntroDbBundle)[type] ?? [];
}

/**
 * True when `positionMs` falls inside any segment of `type`.
 * Accepts the full bundle or a plain list of segments of that type.
 */
export function isSegmentActive(
  type: TheIntroDbSegmentType,
  segments: TheIntroDbBundle | readonly TheIntroDbSegment[] | null | undefined,
  positionMs: number,
): boolean {
  const pos = finiteOr(positionMs, 0);
  const list = resolveList(segments, type);
  for (const segment of list) {
    const start = segment?.startMs == null ? 0 : finiteOr(segment.startMs, 0);
    const end =
      segment?.endMs == null
        ? Number.POSITIVE_INFINITY
        : finiteOr(segment.endMs, Number.POSITIVE_INFINITY);
    if (pos >= start && pos < end) return true;
  }
  return false;
}

/**
 * Credits rating popup gate.
 * Shows once position reaches `credits[0].start_ms` (null start = 0),
 * but never when already shown this session or the user already reviewed.
 */
export function shouldShowCreditsPopup(
  credits: readonly TheIntroDbSegment[] | null | undefined,
  positionMs: number,
  gate: { shown: boolean; alreadyReviewed: boolean },
): boolean {
  if (gate.shown || gate.alreadyReviewed) return false;
  const list = credits ?? [];
  if (list.length === 0) return false;
  const first = list[0];
  const start = first?.startMs == null ? 0 : finiteOr(first.startMs, 0);
  return finiteOr(positionMs, 0) >= start;
}

/**
 * Seek target after a skip: `end_ms + 300ms`.
 * Returns `null` when the segment has no end (open-ended / EOF).
 */
export function skipTargetMs(
  segment: Pick<TheIntroDbSegment, "endMs"> | null | undefined,
): number | null {
  const end = segment?.endMs;
  if (end == null) return null;
  const n = finiteOr(end, Number.NaN);
  if (!Number.isFinite(n)) return null;
  return n + 300;
}

/**
 * Flatten the bundle into seek-bar markers / chapter rows, sorted by start.
 * `startMs` is resolved (null → 0). Ties break by type name for stability.
 */
export function markerList(
  segments: TheIntroDbBundle | null | undefined,
): SegmentMarker[] {
  const bundle = segments ?? emptyBundle();
  const out: SegmentMarker[] = [];
  for (const type of SEGMENT_TYPES) {
    for (const segment of bundle[type] ?? []) {
      if (!segment) continue;
      out.push({
        type,
        startMs: segment.startMs == null ? 0 : finiteOr(segment.startMs, 0),
        endMs: segment.endMs == null ? null : finiteOr(segment.endMs, Number.NaN),
        label: segmentLabel(type),
      });
    }
  }
  // Normalize non-finite ends to null so UI never sees NaN.
  for (const marker of out) {
    if (marker.endMs != null && !Number.isFinite(marker.endMs)) {
      marker.endMs = null;
    }
  }
  out.sort((a, b) => a.startMs - b.startMs || a.type.localeCompare(b.type));
  return out;
}

/** First segment of `type` at/after `positionMs`, or null. */
export function firstSegmentOfType(
  type: TheIntroDbSegmentType,
  segments: TheIntroDbBundle | readonly TheIntroDbSegment[] | null | undefined,
): TheIntroDbSegment | null {
  const list = resolveList(segments, type);
  return list.length > 0 ? list[0] : null;
}
