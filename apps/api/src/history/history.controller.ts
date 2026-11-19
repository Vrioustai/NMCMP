import type { Page, UserProfile, WatchHistoryItem } from "@movie/contracts";
import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { HistoryQueryDto, SaveProgressDto } from "./history.dto";
import { HistoryService } from "./history.service";

@Controller()
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Put("me/history/:episodeId")
  save(
    @CurrentUser() user: UserProfile,
    @Param("episodeId", ParseIntPipe) episodeId: number,
    @Body() dto: SaveProgressDto,
  ): Promise<{ episodeId: number; progressSec: number }> {
    return this.history.save(user, episodeId, dto);
  }

  @Get("me/history")
  list(
    @CurrentUser() user: UserProfile,
    @Query() query: HistoryQueryDto,
  ): Promise<Page<WatchHistoryItem>> {
    return this.history.list(user.id, query);
  }
}
