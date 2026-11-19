import type { PlaybackInfo, UserProfile } from "@movie/contracts";
import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { PlaybackService } from "./playback.service";

@Controller("episodes")
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @Get(":id/playback")
  play(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: UserProfile,
  ): Promise<PlaybackInfo> {
    return this.playback.play(id, user);
  }
}
