import type { PlaybackInfo, SubtitleTrack, UserProfile } from "@movie/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { requireWatchableEpisode } from "../catalog/catalog-access";
import { AppError } from "../common/app-error";
import { Clock } from "../common/clock";
import type { ApiEnv } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import { VIDEO_PROVIDER, type VideoProvider } from "../video/video-provider";

const RESUME_MIN_PROGRESS_SEC = 10;
const RESUME_MIN_REMAINING_SEC = 30;

@Injectable()
export class PlaybackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnv, true>,
    @Inject(VIDEO_PROVIDER) private readonly video: VideoProvider,
  ) {}

  async play(episodeId: number, user: UserProfile, now = new Date()): Promise<PlaybackInfo> {
    const episode = await requireWatchableEpisode(this.prisma, episodeId, {
      birthYear: user.birthYear,
      year: new Clock(now).year(),
    });
    if (!episode.streamUid) throw new AppError("NOT_FOUND");

    const ttl = this.config.getOrThrow("PLAYBACK_TOKEN_TTL_SEC");
    const [link, history, next] = await Promise.all([
      this.video.createPlaybackUrl(episode.streamUid, ttl),
      this.prisma.watchHistory.findUnique({
        where: { userId_episodeId: { userId: user.id, episodeId } },
        select: { progressSec: true },
      }),
      this.prisma.episode.findFirst({
        where: {
          movieId: episode.movieId,
          OR: [
            { seasonNumber: episode.seasonNumber, number: { gt: episode.number } },
            { seasonNumber: { gt: episode.seasonNumber } },
          ],
        },
        orderBy: [{ seasonNumber: "asc" }, { number: "asc" }],
        select: { id: true },
      }),
    ]);

    const resume = resumeAtSec(history?.progressSec ?? 0, episode.durationSec);
    return {
      episodeId: episode.id,
      hlsUrl: link.hlsUrl,
      expiresAt: link.expiresAt.toISOString(),
      subtitles: episode.subtitles.map(toTrack),
      ...(resume === undefined ? {} : { resumeAtSec: resume }),
      nextEpisodeId: next?.id ?? null,
    };
  }
}

// FR15: chỉ đề nghị xem tiếp khi đã xem hơn 10 giây và còn hơn 30 giây.
export function resumeAtSec(progressSec: number, durationSec: number | null): number | undefined {
  if (durationSec == null) return undefined;
  if (progressSec <= RESUME_MIN_PROGRESS_SEC) return undefined;
  if (durationSec - progressSec <= RESUME_MIN_REMAINING_SEC) return undefined;
  return progressSec;
}

function toTrack(subtitle: { language: string; url: string }): SubtitleTrack {
  return {
    language: subtitle.language,
    label: subtitle.language === "vi" ? "Tiếng Việt" : subtitle.language,
    url: subtitle.url,
  };
}
