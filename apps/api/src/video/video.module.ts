import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../config/env.schema";
import { CloudflareStreamProvider } from "./cloudflare-stream.provider";
import { DriveStreamController } from "./drive-stream.controller";
import { HlsStreamController } from "./hls-stream.controller";
import { FakeManifestController } from "./fake-manifest.controller";
import { FakeVideoProvider } from "./fake-video.provider";
import { VIDEO_PROVIDER, type VideoProvider } from "./video-provider";

@Module({
  controllers: [FakeManifestController, DriveStreamController, HlsStreamController],
  providers: [
    {
      provide: VIDEO_PROVIDER,
      useFactory: (config: ConfigService<ApiEnv, true>) => createVideoProvider(config),
      inject: [ConfigService],
    },
  ],
  exports: [VIDEO_PROVIDER],
})
export class VideoModule {}

// Máy local để VIDEO_PROVIDER=fake: không đọc khóa và không gọi ra ngoài.
export function createVideoProvider(config: ConfigService<ApiEnv, true>): VideoProvider {
  const now = () => new Date();
  if (config.get("VIDEO_PROVIDER") === "cloudflare") {
    return new CloudflareStreamProvider({
      accountId: required(config, "CF_ACCOUNT_ID"),
      apiToken: required(config, "CF_STREAM_API_TOKEN"),
      customerCode: required(config, "CF_STREAM_CUSTOMER_CODE"),
      keyId: required(config, "CF_STREAM_KEY_ID"),
      keyJwk: required(config, "CF_STREAM_KEY_JWK"),
      now,
    });
  }
  return new FakeVideoProvider({
    fakeHlsUrl: required(config, "FAKE_HLS_URL"),
    webOrigin: config.getOrThrow("WEB_ORIGIN"),
    now,
  });
}

function required(config: ConfigService<ApiEnv, true>, key: keyof ApiEnv): string {
  const value = config.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${String(key)} chưa được đặt.`);
  }
  return value;
}
