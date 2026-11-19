import { placeholderPlaylist, rewriteHlsPlaylist } from "./hls-playlist";
import { packageMode, reusePackage } from "./hls-packager";

describe("HLS package mode", () => {
  it("keeps an H.264 copy and rebuilds any other codec", () => {
    expect(packageMode("h264")).toBe("copy");
    expect(packageMode("av1")).toBe("h264");
    expect(reusePackage(true, null, "copy")).toBe(true);
    expect(reusePackage(true, null, "h264")).toBe(false);
    expect(reusePackage(false, "h264", "h264")).toBe(false);
  });
});

describe("HLS playlist", () => {
  it("publishes a first segment before ffmpeg has written anything", () => {
    const body = placeholderPlaylist("http://localhost:3000/api/video/hls/tap/seg000.ts?exp=1&sig=a");
    expect(body.startsWith("#EXTM3U")).toBe(true);
    expect(body).toContain("seg000.ts?exp=1&sig=a");
    expect(body).not.toContain("#EXT-X-ENDLIST");
  });

  it("rewrites finished segment names and drops a half-written line", () => {
    const raw = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXTINF:6.000,",
      "seg000.ts",
      "#EXTINF:6.000,",
      "seg001.ts",
      "#EXTINF:2.00",
    ].join("\n");
    const body = rewriteHlsPlaylist(raw, (name) => `http://localhost/api/video/hls/tap/${name}?exp=1&sig=a`);
    expect(body).toContain("http://localhost/api/video/hls/tap/seg000.ts?exp=1&sig=a");
    expect(body).toContain("seg001.ts?exp=1&sig=a");
    expect(body).not.toContain("#EXTINF:2.00");
  });
});
