import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountStatusService } from "./account-status.service";
import { BannedWordsService } from "./banned-words.service";
import { DanmakuController } from "./danmaku.controller";
import { DanmakuGateway } from "./danmaku.gateway";
import { DanmakuService } from "./danmaku.service";
import { RateLimitService } from "./rate-limit.service";

@Module({
  imports: [AuthModule],
  controllers: [DanmakuController],
  providers: [
    DanmakuGateway,
    DanmakuService,
    BannedWordsService,
    RateLimitService,
    AccountStatusService,
  ],
  exports: [BannedWordsService, DanmakuService],
})
export class DanmakuModule {}
