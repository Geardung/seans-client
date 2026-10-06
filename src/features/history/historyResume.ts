/**
 * Resume lookup (M9). GET /api/history for a task file and map it to a
 * start position. Room mode (M10) skips this — host sync owns the position.
 */

import { fetchHistory } from "../../api/endpoints";
import { findHistoryForFile, resumePositionFromHistory } from "./historyHelpers";

/**
 * Load the resume position (seconds) for `taskFileId`, or null when there is
 * nothing to resume (no row / completed / position 0). Errors resolve to null
 * so a flaky history GET never blocks playback.
 */
export async function fetchResumePosition(
  taskFileId: string | number,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const list = await fetchHistory({ limit: 200, signal });
    return resumePositionFromHistory(findHistoryForFile(list, taskFileId));
  } catch {
    return null;
  }
}
