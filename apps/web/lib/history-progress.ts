export function progressPercent(progressSec: number, durationSec: number | null): number | null {
  if (durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  if (!Number.isFinite(progressSec) || progressSec <= 0) return 0;
  return Math.min(100, (progressSec / durationSec) * 100);
}
