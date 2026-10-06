/**
 * TheIntroDB feature barrel (M8). Pure helpers live in `introSegments`.
 */

export {
  firstSegmentOfType,
  isSegmentActive,
  markerList,
  shouldShowCreditsPopup,
  skipTargetMs,
} from "./introSegments";
export {
  clearSegmentCache,
  fetchSegments,
  normalizeTheIntroDbBundle,
  peekSegmentCache,
  segmentCacheKey,
  THEINTRODB_BASE_URL,
} from "./theintrodbApi";
export type { FetchSegmentsParams } from "./theintrodbApi";
export {
  emptyBundle,
  EMPTY_BUNDLE,
  SEGMENT_COLOR_CLASS,
  SEGMENT_TYPES,
  segmentLabel,
} from "./types";
export type {
  ActiveSkip,
  SegmentMarker,
  TheIntroDbBundle,
  TheIntroDbSegment,
  TheIntroDbSegmentType,
} from "./types";
export { CreditsPopup } from "./CreditsPopup";
export type { CreditsPopupProps } from "./CreditsPopup";
export {
  ChaptersMenu,
  SeekMarkers,
  SkipButtons,
  SKIP_HIDE_DELAY_MS,
} from "./SegmentChrome";
export type {
  ChaptersMenuProps,
  SeekMarkersProps,
  SkipButtonsProps,
} from "./SegmentChrome";
export { SKIP_LINGER_MS, useSegmentChrome } from "./useSegmentChrome";
export type { SegmentChromeState } from "./useSegmentChrome";
export { useTheIntroDb } from "./useTheIntroDb";
export type { TheIntroDbContext, TheIntroDbState } from "./useTheIntroDb";
