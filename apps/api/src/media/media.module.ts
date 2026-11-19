import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../config/env.schema";
import { MediaStorage } from "./media-storage";

@Global()
@Module({
  providers: [
    {
      provide: MediaStorage,
      useFactory: (config: ConfigService<ApiEnv, true>) =>
        new MediaStorage(config.getOrThrow("MEDIA_DIR")),
      inject: [ConfigService],
    },
  ],
  exports: [MediaStorage],
})
export class MediaModule {}
