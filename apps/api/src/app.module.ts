import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { AppConfigModule } from "./config/config.module";
import { CommentsModule } from "./comments/comments.module";
import { DanmakuModule } from "./danmaku/danmaku.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { HealthModule } from "./health/health.module";
import { HistoryModule } from "./history/history.module";
import { MediaModule } from "./media/media.module";
import { MoviesModule } from "./movies/movies.module";
import { PlaybackModule } from "./playback/playback.module";
import { RatingsModule } from "./ratings/ratings.module";
import { ReportsModule } from "./reports/reports.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { UsersModule } from "./users/users.module";
import { VideoModule } from "./video/video.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    MediaModule,
    HealthModule,
    HistoryModule,
    MoviesModule,
    PlaybackModule,
    AuthModule,
    DanmakuModule,
    ReportsModule,
    RatingsModule,
    CommentsModule,
    FavoritesModule,
    AdminModule,
    UsersModule,
    VideoModule,
  ],
})
export class AppModule {}
