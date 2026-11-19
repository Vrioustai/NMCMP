import { laneCount, pickLane, TRAVEL_MS } from "./lanes";
import { liveDecision } from "./live";
import { parseSettings, readSettings, writeSettings } from "./settings";
import { danmakuEndpoint } from "./socket-url";
import { commentsDue, cursorAfterSeek, insertComment, isSeek } from "./timeline";

const row = (id: number, timeMs: number) => ({ id, timeMs });

describe("lanes", () => {
  it("keeps one lane at the lowest density", () => {
    expect(laneCount(200, 25)).toBe(1);
    expect(laneCount(200, 100)).toBe(6);
  });

  it("occupies a free lane for the travel time", () => {
    const first = pickLane([0, 0], 1000);
    expect(first.lane).toBe(0);
    expect(first.freeAt[0]).toBe(1000 + TRAVEL_MS);
    const second = pickLane(first.freeAt, 1000);
    expect(second.lane).toBe(1);
  });
});

describe("timeline", () => {
  const items = [row(1, 1000), row(2, 2000), row(3, 3000)];

  it("emits comments the playhead has reached", () => {
    const step = commentsDue(items, 0, 2000);
    expect(step.due.map((item) => item.id)).toEqual([1, 2]);
    expect(step.cursor).toBe(2);
  });

  it("treats a jump longer than half a second as a seek", () => {
    expect(isSeek(1000, 1400)).toBe(false);
    expect(isSeek(1000, 1600)).toBe(true);
    expect(isSeek(2000, 1000)).toBe(true);
    expect(cursorAfterSeek(items, 2500)).toBe(2);
  });

  it("inserts by time and keeps the cursor past earlier rows", () => {
    const placed = insertComment(items, 2, row(4, 1500));
    expect(placed.items.map((item) => item.id)).toEqual([1, 4, 2, 3]);
    expect(placed.cursor).toBe(3);
    expect(insertComment(placed.items, placed.cursor, row(4, 1500)).items).toBe(placed.items);
  });
});

describe("live comments", () => {
  it("shows the sender immediately and holds far comments for the playhead", () => {
    expect(liveDecision({ mine: true, commentTimeMs: 90_000, videoTimeMs: 0 })).toBe("now");
    expect(liveDecision({ mine: false, commentTimeMs: 8000, videoTimeMs: 0 })).toBe("now");
    expect(liveDecision({ mine: false, commentTimeMs: 20_000, videoTimeMs: 0 })).toBe("later");
  });
});

describe("settings", () => {
  it("falls back when the stored value is unusable", () => {
    expect(parseSettings(null)).toEqual({ enabled: true, density: 100, opacity: 100 });
    expect(parseSettings("{")).toEqual({ enabled: true, density: 100, opacity: 100 });
    expect(parseSettings(JSON.stringify({ enabled: false, density: 10, opacity: 5 }))).toEqual({
      enabled: false,
      density: 100,
      opacity: 20,
    });
  });

  it("reads and writes through a storage that can throw", () => {
    const box = new Map<string, string>();
    const storage = {
      getItem: (key: string) => box.get(key) ?? null,
      setItem: (key: string, value: string) => {
        box.set(key, value);
      },
    };
    writeSettings(storage, { enabled: false, density: 50, opacity: 40 });
    expect(readSettings(storage).density).toBe(50);
    expect(
      readSettings({
        getItem: () => {
          throw new Error("blocked");
        },
      }).enabled,
    ).toBe(true);
  });
});

describe("socket url", () => {
  it("uses the configured origin and otherwise stays on this site", () => {
    expect(danmakuEndpoint("http://localhost:4000/")).toBe("http://localhost:4000/danmaku");
    expect(danmakuEndpoint("  ")).toBe("/danmaku");
    expect(danmakuEndpoint(undefined)).toBe("/danmaku");
  });
});
