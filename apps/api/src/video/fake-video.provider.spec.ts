import { AppError } from "../common/app-error";
import { FakeManifestController } from "./fake-manifest.controller";
import { BROKEN_HLS_URL, FakeVideoProvider, SLOW_MANIFEST_DELAY_MS } from "./fake-video.provider";

const NOW = new Date("2026-11-19T06:00:00.000Z");
const SAMPLE = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

function provider(fakeHlsUrl = SAMPLE): FakeVideoProvider {
  return new FakeVideoProvider({ fakeHlsUrl, webOrigin: "http://localhost:3000" });
}

function manifest(providerName: string): FakeManifestController {
  return new FakeManifestController({
    get: (key: string) => (key === "VIDEO_PROVIDER" ? providerName : undefined),
  } as never);
}

describe("FakeVideoProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("TEST_UC07_08 returns the public sample and an expiry of now plus ttl", async () => {
    const link = await provider().createPlaybackUrl("episode-1", 60);
    expect(link.hlsUrl).toBe(SAMPLE);
    expect(link.expiresAt.toISOString()).toBe("2026-11-19T06:01:00.000Z");
    expect(link.hlsUrl).not.toMatch(/PRIVATE|BEGIN |jwk/);
  });

  it("TEST_UC07_08 marks an expired uid as already expired", async () => {
    const link = await provider().createPlaybackUrl("expired:episode-1", 60);
    expect(link.hlsUrl).toBe(SAMPLE);
    expect(link.expiresAt.getTime()).toBeLessThan(NOW.getTime());
  });

  it("TEST_UC07_09 returns a url the player cannot load", async () => {
    const link = await provider("").createPlaybackUrl("error", 60);
    expect(link.hlsUrl).toBe(BROKEN_HLS_URL);
    expect(link.expiresAt.toISOString()).toBe("2026-11-19T06:01:00.000Z");
  });

  it("TEST_UC07_09 points at a manifest that waits 4 seconds", async () => {
    const link = await provider().createPlaybackUrl("slow", 7200);
    expect(link.hlsUrl).toBe("http://localhost:3000/api/video/fake-manifest?slow=1");

    let done = false;
    const pending = manifest("fake")
      .manifest("1")
      .then((body) => {
        done = true;
        return body;
      });
    await jest.advanceTimersByTimeAsync(SLOW_MANIFEST_DELAY_MS - 1);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const body = await pending;
    expect(body).toContain("#EXTM3U");
    expect(body).toContain("filmgenz.invalid");
  });

  it("hides the slow manifest unless the local provider is selected", async () => {
    await expect(manifest("cloudflare").manifest("1")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a ttl outside 1 second to 24 hours", async () => {
    await expect(provider().createPlaybackUrl("episode-1", 0)).rejects.toThrow(
      "PLAYBACK_TOKEN_TTL_SEC không hợp lệ.",
    );
    await expect(provider().createPlaybackUrl("episode-1", 86_401)).rejects.toThrow(
      "PLAYBACK_TOKEN_TTL_SEC không hợp lệ.",
    );
  });

  it("reports an unsigned video until the flag is turned on", async () => {
    const video = provider();
    await expect(video.getVideo("unsigned:tap")).resolves.toMatchObject({
      requireSignedURLs: false,
      ready: true,
      durationSec: 90,
    });
    await video.enableSignedUrls("unsigned:tap");
    await expect(video.getVideo("unsigned:tap")).resolves.toMatchObject({
      requireSignedURLs: true,
    });
    await expect(video.getVideo("error:tap")).rejects.toBeInstanceOf(AppError);
  });

  it("names FAKE_HLS_URL when the sample url is missing", async () => {
    await expect(provider("").createPlaybackUrl("episode-1", 60)).rejects.toThrow(
      "FAKE_HLS_URL chưa được đặt.",
    );
  });
});
