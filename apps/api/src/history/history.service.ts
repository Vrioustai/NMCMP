import type { UserProfile, WatchHistoryItem } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { requireWatchableEpisode } from "../catalog/catalog-access";
import { Clock } from "../common/clock";
import { pageQuery, type Page } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import type { HistoryQueryDto, SaveProgressDto } from "./history.dto";

type HistoryRow = {
  movie_id: number;
  slug: string;
  title: string;
  poster_url: string | null;
  release_year: number;
  age_rating: WatchHistoryItem["movie"]["ageRating"];
  type: WatchHistoryItem["movie"]["type"];
  episode_id: number;
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  duration_sec: number | null;
  progress_sec: number;
  watched_at: Date | string;
};

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    user: UserProfile,
    episodeId: number,
    dto: SaveProgressDto,
    now = new Date(),
  ): Promise<{ episodeId: number; progressSec: number }> {
    await requireWatchableEpisode(this.prisma, episodeId, {
      birthYear: user.birthYear,
      year: new Clock(now).year(),
    });
    const row = await this.prisma.watchHistory.upsert({
      where: { userId_episodeId: { userId: user.id, episodeId } },
      create: { userId: user.id, episodeId, progressSec: dto.progressSec },
      update: { progressSec: dto.progressSec },
    });
    return { episodeId: row.episodeId, progressSec: row.progressSec };
  }

  async list(userId: number, query: HistoryQueryDto): Promise<Page<WatchHistoryItem>> {
    const page = pageQuery(query);
    const [count, rows] = await Promise.all([
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(DISTINCT e.movie_id)::int AS total
        FROM watch_histories h
        JOIN episodes e ON e.id_episode = h.episode_id
        JOIN movies m ON m.id_movie = e.movie_id
        WHERE h.user_id = ${userId}
          AND m.status = 'PUBLISHED'::movie_status
      `,
      // Mỗi phim một dòng: trong một phim lấy lần ghi mới nhất, rồi mới xếp các phim.
      this.prisma.$queryRaw<HistoryRow[]>`
        SELECT
          movie_id, slug, title, poster_url, release_year, age_rating, type,
          episode_id, season_number, episode_number, episode_title, duration_sec,
          progress_sec, watched_at
        FROM (
          SELECT DISTINCT ON (e.movie_id)
            m.id_movie AS movie_id,
            m.slug,
            m.title,
            m.poster_url,
            m.release_year,
            m.age_rating,
            m.type::text AS type,
            e.id_episode AS episode_id,
            e.season_number,
            e.number AS episode_number,
            e.title AS episode_title,
            e.duration_sec,
            h.progress_sec,
            h.updated_at AS watched_at
          FROM watch_histories h
          JOIN episodes e ON e.id_episode = h.episode_id
          JOIN movies m ON m.id_movie = e.movie_id
          WHERE h.user_id = ${userId}
            AND m.status = 'PUBLISHED'::movie_status
          ORDER BY e.movie_id, h.updated_at DESC, h.id_watch_history DESC
        ) latest
        ORDER BY watched_at DESC, episode_id DESC
        LIMIT ${page.take} OFFSET ${page.skip}
      `,
    ]);
    return {
      items: rows.map(toItem),
      page: page.page,
      pageSize: page.pageSize,
      total: Number(count[0]?.total ?? 0),
    };
  }
}

function toItem(row: HistoryRow): WatchHistoryItem {
  return {
    movie: {
      id: Number(row.movie_id),
      slug: row.slug,
      title: row.title,
      posterUrl: row.poster_url,
      releaseYear: Number(row.release_year),
      ageRating: row.age_rating,
      type: row.type,
    },
    episode: {
      id: Number(row.episode_id),
      seasonNumber: Number(row.season_number),
      number: Number(row.episode_number),
      title: row.episode_title,
      durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    },
    progressSec: Number(row.progress_sec),
    watchedAt: new Date(row.watched_at).toISOString(),
  };
}
