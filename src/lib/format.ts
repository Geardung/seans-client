/**
 * Pure byte/speed formatters (M5). No React/DOM — unit-testable.
 * Binary units (1024) with Russian labels.
 */

const BYTE_UNITS = ["Б", "КБ", "МБ", "ГБ", "ТБ"] as const;

/**
 * Human-readable size, e.g. `0 Б`, `512 Б`, `1.0 КБ`, `2.5 ГБ`.
 * Non-finite / nullish input is treated as 0.
 */
export function formatBytes(bytes: number | null | undefined): string {
  const n = typeof bytes === "number" && Number.isFinite(bytes) ? bytes : 0;
  const sign = n < 0 ? "-" : "";
  let value = Math.abs(n);
  if (value < 1024) {
    return `${sign}${Math.round(value)} ${BYTE_UNITS[0]}`;
  }
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rendered = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${sign}${rendered} ${BYTE_UNITS[unitIndex]}`;
}

/**
 * Transfer rate in bytes/second, e.g. `1.5 МБ/с`.
 * Zero renders as `0 Б/с`.
 */
export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  return `${formatBytes(bytesPerSecond)}/с`;
}
