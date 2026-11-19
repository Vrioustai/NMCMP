import { clampProgress, refreshDelayMs } from "./playback";

describe("playback timing", () => {
  const now = Date.parse("2026-11-19T09:00:00.000Z");

  it("refreshes a two-hour link five minutes early", () => {
    const expires = new Date(now + 7200 * 1000).toISOString();
    expect(refreshDelayMs(expires, now)).toBe(6900 * 1000);
  });

  it("refreshes a one-minute link without looping", () => {
    const expires = new Date(now + 60 * 1000).toISOString();
    expect(refreshDelayMs(expires, now)).toBe(48 * 1000);
  });

  it("asks for a new link immediately when the current one is already expired", () => {
    const expires = new Date(now - 1000).toISOString();
    expect(refreshDelayMs(expires, now)).toBe(0);
    expect(refreshDelayMs("không phải ngày", now)).toBe(0);
  });

  it("drops a zero position and caps a day", () => {
    expect(clampProgress(0)).toBeNull();
    expect(clampProgress(750.9)).toBe(750);
    expect(clampProgress(90_000)).toBe(86400);
  });
});
