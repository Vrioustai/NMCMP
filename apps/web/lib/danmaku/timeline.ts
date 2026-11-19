export const SEEK_GAP_MS = 500;

export type Timed = { id: number; timeMs: number };

export function isSeek(previousMs: number, nowMs: number): boolean {
  return nowMs < previousMs - 50 || nowMs - previousMs > SEEK_GAP_MS;
}

export function cursorAfterSeek<T extends Timed>(items: T[], nowMs: number): number {
  const from = nowMs - SEEK_GAP_MS;
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (items[mid].timeMs <= from) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function commentsDue<T extends Timed>(
  items: T[],
  cursor: number,
  nowMs: number,
): { due: T[]; cursor: number } {
  const due: T[] = [];
  let index = Math.max(0, cursor);
  while (index < items.length && items[index].timeMs <= nowMs) {
    due.push(items[index]);
    index += 1;
  }
  return { due, cursor: index };
}

export function insertComment<T extends Timed>(
  items: T[],
  cursor: number,
  item: T,
): { items: T[]; cursor: number } {
  if (items.some((row) => row.id === item.id)) return { items, cursor };
  let index = 0;
  while (
    index < items.length &&
    (items[index].timeMs < item.timeMs ||
      (items[index].timeMs === item.timeMs && items[index].id < item.id))
  ) {
    index += 1;
  }
  const next = items.slice();
  next.splice(index, 0, item);
  return { items: next, cursor: index < cursor ? cursor + 1 : cursor };
}
