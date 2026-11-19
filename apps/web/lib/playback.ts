const LEAD_CAP_SEC = 300;

// Hẹn lại trước lúc URL hết hạn. Phần trừ phụ thuộc thời gian còn lại lúc nhận URL,
// để TTL ngắn không bị gọi lại liên tục.
export function refreshDelayMs(expiresAt: string, nowMs: number): number {
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return 0;
  const remainingMs = expiresMs - nowMs;
  if (remainingMs <= 0) return 0;
  const leadMs = Math.min(LEAD_CAP_SEC * 1000, remainingMs / 5);
  return Math.max(0, remainingMs - leadMs);
}

export function clampProgress(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(86400, Math.floor(seconds));
}
