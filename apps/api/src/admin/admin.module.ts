import { Module } from "@nestjs/common";
import { DanmakuModule } from "../danmaku/danmaku.module";
import { VideoModule } from "../video/video.module";
import { AdminAssetsService } from "./admin-assets.service";
import { AdminEpisodesController } from "./admin-episodes.controller";
import { AdminEpisodesService } from "./admin-episodes.service";
import { AdminGenresController } from "./admin-genres.controller";
import { AdminGenresService } from "./admin-genres.service";
import { AdminImagesController } from "./admin-images.controller";
import { AdminMoviesController } from "./admin-movies.controller";
import { AdminMoviesService } from "./admin-movies.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminReportsService } from "./admin-reports.service";
import { AdminStatsController } from "./admin-stats.controller";
import { AdminStatsService } from "./admin-stats.service";
import { AdminWordsController } from "./admin-words.controller";
import { AdminWordsService } from "./admin-words.service";

@Module({
  imports: [VideoModule, DanmakuModule],
  controllers: [
    AdminMoviesController,
    AdminImagesController,
    AdminEpisodesController,
    AdminGenresController,
    AdminUsersController,
    AdminReportsController,
    AdminWordsController,
    AdminStatsController,
  ],
  providers: [
    AdminMoviesService,
    AdminEpisodesService,
    AdminAssetsService,
    AdminGenresService,
    AdminUsersService,
    AdminReportsService,
    AdminWordsService,
    AdminStatsService,
  ],
})
export class AdminModule {}
