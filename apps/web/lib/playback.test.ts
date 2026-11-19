import { clampProgress, isHlsPlaylist, refreshDelayMs } from "./playback";

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

  it("treats an mp4 address as a file and a playlist address as HLS", () => {
    expect(isHlsPlaylist("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")).toBe(true);
    expect(isHlsPlaylist("http://localhost:3000/api/video/fake-manifest?slow=1")).toBe(true);
    expect(isHlsPlaylist("http://localhost:3000/api/video/drive/tap?exp=1&sig=a")).toBe(false);
    expect(
      isHlsPlaylist("http://localhost:3000/api/video/hls/tap/index.m3u8?exp=1&sig=a"),
    ).toBe(true);
  });

  it("drops a zero position and caps a day", () => {
    expect(clampProgress(0)).toBeNull();
    expect(clampProgress(750.9)).toBe(750);
    expect(clampProgress(90_000)).toBe(86400);
  });
});
