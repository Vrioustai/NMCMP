export const LIVE_WINDOW_MS = 10_000;

export function liveDecision(input: {
  mine: boolean;
  commentTimeMs: number;
  videoTimeMs: number;
}): "now" | "later" {
  if (input.mine) return "now";
  if (Math.abs(input.commentTimeMs - input.videoTimeMs) <= LIVE_WINDOW_MS) return "now";
  return "later";
}
