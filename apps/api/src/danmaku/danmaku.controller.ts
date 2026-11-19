import type { DanmakuItem, UserProfile } from "@movie/contracts";
import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { DanmakuService } from "./danmaku.service";

@Controller("episodes")
export class DanmakuController {
  constructor(private readonly danmaku: DanmakuService) {}

  @Get(":id/danmaku")
  list(
    @CurrentUser() user: UserProfile,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<DanmakuItem[]> {
    return this.danmaku.list(id, user);
  }
}
