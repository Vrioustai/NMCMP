import { Controller, Get, Header, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/auth.decorators";
import { AppError } from "../common/app-error";
import type { ApiEnv } from "../config/env.schema";
import { FAKE_MANIFEST, SLOW_MANIFEST_DELAY_MS } from "./fake-video.provider";

// Manifest giả không phải phim. no-store để lần thử lại của trình phát vẫn gặp độ trễ.
@Public()
@Controller("video")
export class FakeManifestController {
  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  @Get("fake-manifest")
  @Header("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async manifest(@Query("slow") slow?: string): Promise<string> {
    if (this.config.get("VIDEO_PROVIDER") !== "fake") throw new AppError("NOT_FOUND");
    if (slow === "1") await wait(SLOW_MANIFEST_DELAY_MS);
    return FAKE_MANIFEST;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
