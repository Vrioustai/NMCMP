import { Module } from "@nestjs/common";
import { VideoModule } from "../video/video.module";
import { PlaybackController } from "./playback.controller";
import { PlaybackService } from "./playback.service";

@Module({
  imports: [VideoModule],
  controllers: [PlaybackController],
  providers: [PlaybackService],
})
export class PlaybackModule {}
