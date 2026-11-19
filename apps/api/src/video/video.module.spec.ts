import { generateKeyPairSync } from "crypto";
import type { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../config/env.schema";
import { CloudflareStreamProvider } from "./cloudflare-stream.provider";
import { FakeVideoProvider } from "./fake-video.provider";
import { createVideoProvider } from "./video.module";

function config(values: Record<string, string | undefined>): ConfigService<ApiEnv, true> {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(key);
      return value;
    },
  } as unknown as ConfigService<ApiEnv, true>;
}

describe("createVideoProvider", () => {
  it("selects the local provider and does not require a signing key", async () => {
    const video = createVideoProvider(
      config({
        VIDEO_PROVIDER: "fake",
        FAKE_HLS_URL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        WEB_ORIGIN: "http://localhost:3000",
      }),
    );
    expect(video).toBeInstanceOf(FakeVideoProvider);
    const link = await video.createPlaybackUrl("episode-1", 60);
    expect(link.hlsUrl).toBe("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
  });

  it("names FAKE_HLS_URL when the local sample is missing", () => {
    expect(() => createVideoProvider(config({ VIDEO_PROVIDER: "fake" }))).toThrow(
      "FAKE_HLS_URL chưa được đặt.",
    );
  });

  it("selects the remote provider only when the variable says so", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const keyJwk = Buffer.from(JSON.stringify(privateKey.export({ format: "jwk" }))).toString(
      "base64",
    );
    const video = createVideoProvider(
      config({
        VIDEO_PROVIDER: "cloudflare",
        CF_ACCOUNT_ID: "account",
        CF_STREAM_API_TOKEN: "token",
        CF_STREAM_CUSTOMER_CODE: "customer",
        CF_STREAM_KEY_ID: "key",
        CF_STREAM_KEY_JWK: keyJwk,
      }),
    );
    expect(video).toBeInstanceOf(CloudflareStreamProvider);
  });

  it("names a missing remote variable and does not echo a bad key", () => {
    expect(() =>
      createVideoProvider(
        config({
          VIDEO_PROVIDER: "cloudflare",
          CF_ACCOUNT_ID: "account",
        }),
      ),
    ).toThrow("CF_STREAM_API_TOKEN chưa được đặt.");

    const secret = "SUPER-SECRET-JWK";
    expect(() =>
      createVideoProvider(
        config({
          VIDEO_PROVIDER: "cloudflare",
          CF_ACCOUNT_ID: "account",
          CF_STREAM_API_TOKEN: "token",
          CF_STREAM_CUSTOMER_CODE: "customer",
          CF_STREAM_KEY_ID: "key",
          CF_STREAM_KEY_JWK: Buffer.from(secret).toString("base64"),
        }),
      ),
    ).toThrow("CF_STREAM_KEY_JWK không đọc được.");
  });
});
