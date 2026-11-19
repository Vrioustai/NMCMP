export const TRAVEL_MS = 8000;
export const LANE_HEIGHT_PX = 32;

export function laneCount(bandHeight: number, densityPercent: number): number {
  const full = Math.max(1, Math.floor(Math.max(0, bandHeight) / LANE_HEIGHT_PX));
  const used = Math.floor(full * (densityPercent / 100));
  return Math.max(1, used);
}

export function pickLane(freeAt: number[], now: number): { lane: number; freeAt: number[] } {
  if (freeAt.length === 0) return { lane: 0, freeAt: [now + TRAVEL_MS] };
  const next = freeAt.slice();
  let lane = next.findIndex((time) => time <= now);
  if (lane < 0) {
    lane = 0;
    for (let index = 1; index < next.length; index += 1) {
      if (next[index] < next[lane]) lane = index;
    }
  }
  next[lane] = now + TRAVEL_MS;
  return { lane, freeAt: next };
}
