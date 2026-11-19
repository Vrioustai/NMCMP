import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../config/env.schema";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      useFactory: (config: ConfigService<ApiEnv, true>) =>
        RedisService.connect(config.getOrThrow("REDIS_URL")),
      inject: [ConfigService],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
