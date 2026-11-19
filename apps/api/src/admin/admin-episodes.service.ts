import { Inject, Injectable, Logger } from "@nestjs/common";
import { AppError } from "../common/app-error";
import { mediaRelative, MediaStorage } from "../media/media-storage";
import { PrismaService } from "../prisma/prisma.service";
import { VIDEO_PROVIDER, type VideoProvider } from "../video/video-provider";
import type {
  CreateEpisodeDto,
  StreamCopyDto,
  DirectUploadDto,
  SetStreamDto,
  UpdateEpisodeDto,
} from "./admin-episodes.dto";

const DEFAULT_MAX_DURATION_SEC = 3_600;

export type AdminEpisode = {
  id: number;
  movieId: number;
  seasonNumber: number;
  number: number;
  title: string | null;
  streamUid: string | null;
  durationSec: number | null;
};

type EpisodeRow = AdminEpisode & {
  movie?: { slug: string; type: string };
  subtitles?: { url: string }[];
};

@Injectable()
export class AdminEpisodesService {
  private readonly logger = new Logger(AdminEpisodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
    @Inject(VIDEO_PROVIDER) private readonly video: VideoProvider,
  ) {}

  async create(movieId: number, dto: CreateEpisodeDto): Promise<AdminEpisode> {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
      select: { id: true, type: true },
    });
    if (!movie) throw new AppError("NOT_FOUND");
    if (movie.type === "MOVIE") {
      throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
        { field: "number", message: "Phim lẻ đã có tập 1" },
      ]);
    }
    const episode = await this.prisma.episode.create({
      data: {
        movieId,
        seasonNumber: dto.seasonNumber ?? 1,
        number: dto.number,
        title: dto.title ?? null,
      },
    });
    return toEpisode(episode);
  }

  async update(id: number, dto: UpdateEpisodeDto): Promise<AdminEpisode> {
    const existing = await this.prisma.episode.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND");
    const data: { seasonNumber?: number; number?: number; title?: string | null } = {};
    if (dto.seasonNumber !== undefined) data.seasonNumber = dto.seasonNumber;
    if (dto.number !== undefined) data.number = dto.number;
    if (dto.title !== undefined) data.title = dto.title;
    if (Object.keys(data).length === 0) return toEpisode(existing);
    const episode = await this.prisma.episode.update({ where: { id }, data });
    return toEpisode(episode);
  }

  async remove(id: number): Promise<void> {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: { subtitles: { select: { url: true } } },
    });
    if (!episode) throw new AppError("NOT_FOUND");
    await this.prisma.episode.delete({ where: { id } });
    for (const subtitle of episode.subtitles) {
      const file = mediaRelative(subtitle.url);
      if (!file) continue;
      try {
        await this.storage.remove(file);
      } catch {
        this.logger.warn(`Không xóa được phụ đề của tập ${id}.`);
      }
    }
  }

  // Hỏi provider trước. Cờ chữ ký đang tắt thì bật xong mới ghi mã video.
  async setStream(id: number, dto: SetStreamDto): Promise<AdminEpisode> {
    const episode = await this.requiredEpisode(id);
    const video = await this.video.getVideo(dto.streamUid);
    if (!video.ready) {
      throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
        { field: "streamUid", message: "Video chưa sẵn sàng" },
      ]);
    }
    if (!video.requireSignedURLs) await this.video.enableSignedUrls(dto.streamUid);
    const updated = await this.prisma.episode.update({
      where: { id: episode.id },
      data: { streamUid: dto.streamUid, durationSec: wholeSeconds(video.durationSec) },
    });
    return toEpisode(updated);
  }

  async createUpload(
    id: number,
    dto: DirectUploadDto,
  ): Promise<{ uid: string; uploadUrl: string }> {
    const episode = await this.requiredEpisode(id);
    return this.video.createDirectUpload({
      maxDurationSeconds: dto.maxDurationSeconds ?? DEFAULT_MAX_DURATION_SEC,
      metaName: metaName(episode),
    });
  }

  async copyStream(id: number, dto: StreamCopyDto): Promise<{ streamUid: string }> {
    const episode = await this.requiredEpisode(id);
    const copied = await this.video.copyFromUrl(dto.url, metaName(episode));
    return { streamUid: copied.uid };
  }

  private async requiredEpisode(id: number): Promise<EpisodeRow> {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: { movie: { select: { slug: true, type: true } } },
    });
    if (!episode) throw new AppError("NOT_FOUND");
    return episode;
  }
}

function toEpisode(episode: AdminEpisode): AdminEpisode {
  return {
    id: episode.id,
    movieId: episode.movieId,
    seasonNumber: episode.seasonNumber,
    number: episode.number,
    title: episode.title,
    streamUid: episode.streamUid,
    durationSec: episode.durationSec,
  };
}

function metaName(episode: EpisodeRow): string {
  const slug = episode.movie?.slug ?? "phim";
  return `${slug}/s${episode.seasonNumber}e${episode.number}`;
}

function wholeSeconds(durationSec: number | null): number | null {
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec < 0) return null;
  return Math.round(durationSec);
}
