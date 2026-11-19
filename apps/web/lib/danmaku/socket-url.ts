export function danmakuEndpoint(configured: string | undefined): string {
  const raw = configured?.trim().replace(/\/$/, "");
  return raw ? `${raw}/danmaku` : "/danmaku";
}
