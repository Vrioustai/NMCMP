import {
  type Country,
  type EpisodeSummary,
  type Genre,
  type HomeSections,
  type MovieCard,
  type MovieDetail,
  type NamedRef,
  type Page,
} from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { requirePublishedMovie } from "../catalog/catalog-access";
import { ratingAverage } from "../ratings/rating-score";
import { pageQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import type { MovieListQueryDto } from "./movies.dto";

const TRENDING_LIMIT = 10;
const NEW_LIMIT = 10;
const GENRE_ROW_LIMIT = 10;
const TRENDING_DAYS = 7;
const TRENDING_TTL_SEC = 10 * 60;
const TRENDING_KEY = "movies:trending";
const DAY_MS = 24 * 60 * 60 * 1000;

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  posterUrl: true,
  releaseYear: true,
  ageRating: true,
  type: true,
  trailerUrl: true,
} satisfies Prisma.MovieSelect;

type CardRow = Prisma.MovieGetPayload<{ select: typeof cardSelect }>;

type Bundle = {
  genres: Genre[] | null;
  countries: Country[] | null;
  credits: { id: number; name: string; role: string }[] | null;
  episodes: EpisodeSummary[] | null;
  rating: { count: number; sum: number };
};

@Injectable()
export class MoviesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(query: MovieListQueryDto): Promise<Page<MovieCard>> {
    const page = pageQuery(query);
    const where: Prisma.MovieWhereInput = {
      status: "PUBLISHED",
      ...(query.releaseYear ? { releaseYear: query.releaseYear } : {}),
      ...(query.genre ? { genres: { some: { genreId: query.genre } } } : {}),
      ...(query.country ? { countries: { some: { countryId: query.country } } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { originalTitle: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.movie.count({ where }),
      this.prisma.movie.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: page.skip,
        take: page.take,
        select: cardSelect,
      }),
    ]);
    return { items: rows.map(toCard), page: page.page, pageSize: page.pageSize, total };
  }

  async detail(slug: string): Promise<MovieDetail> {
    const movie = await requirePublishedMovie(this.prisma, { slug });
    const [bundle] = await this.prisma.$queryRaw<Bundle[]>`
      SELECT
        COALESCE((
          SELECT json_agg(json_build_object('id', g.id_genre, 'name', g.name) ORDER BY g.name, g.id_genre)
          FROM movie_genres mg
          JOIN genres g ON g.id_genre = mg.genre_id
          WHERE mg.movie_id = ${movie.id}
        ), '[]'::json) AS genres,
        COALESCE((
          SELECT json_agg(json_build_object('id', c.id_country, 'name', c.name) ORDER BY c.name, c.id_country)
          FROM movie_countries mc
          JOIN countries c ON c.id_country = mc.country_id
          WHERE mc.movie_id = ${movie.id}
        ), '[]'::json) AS countries,
        COALESCE((
          SELECT json_agg(json_build_object('id', p.id_person, 'name', p.name, 'role', cr.role) ORDER BY cr.role, p.name, p.id_person)
          FROM movie_credits cr
          JOIN people p ON p.id_person = cr.person_id
          WHERE cr.movie_id = ${movie.id}
        ), '[]'::json) AS credits,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', e.id_episode,
            'seasonNumber', e.season_number,
            'number', e.number,
            'title', e.title,
            'durationSec', e.duration_sec
          ) ORDER BY e.season_number, e.number)
          FROM episodes e
          WHERE e.movie_id = ${movie.id}
        ), '[]'::json) AS episodes,
        (
          SELECT json_build_object('count', COUNT(*)::int, 'sum', COALESCE(SUM(score), 0)::int)
          FROM ratings r
          WHERE r.movie_id = ${movie.id}
        ) AS rating
    `;
    const credits = bundle?.credits ?? [];
    const ratingCount = Number(bundle?.rating.count ?? 0);
    const ratingSum = Number(bundle?.rating.sum ?? 0);
    return {
      ...toCard(movie),
      originalTitle: movie.originalTitle,
      description: movie.description,
      backdropUrl: movie.backdropUrl,
      genres: bundle?.genres ?? [],
      countries: bundle?.countries ?? [],
      directors: named(credits, "DIRECTOR"),
      actors: named(credits, "ACTOR"),
      seasons: seasonsOf(bundle?.episodes ?? []),
      ratingAverage: ratingAverage(ratingSum, ratingCount),
      ratingCount,
      sourceUrl: movie.sourceUrl,
      license: movie.license,
    };
  }

  async home(now = new Date()): Promise<HomeSections> {
    const [newList, trendingList, byGenre] = await Promise.all([
      this.newest(),
      this.trending(now),
      this.byGenre(),
    ]);
    return { newList, trendingList, byGenre };
  }

  async trending(now = new Date()): Promise<MovieCard[]> {
    const cached = await this.readTrendingIds();
    const ids = cached ?? (await this.storeTrendingIds(await this.trendingIds(now)));
    if (ids.length === 0) return [];
    const rows = await this.prisma.movie.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: cardSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toCard(row)] : [];
    });
  }

  async genres(): Promise<Genre[]> {
    return this.prisma.genre.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
  }

  async countries(): Promise<Country[]> {
    return this.prisma.country.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
  }

  private async newest(): Promise<MovieCard[]> {
    const rows = await this.prisma.movie.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: NEW_LIMIT,
      select: cardSelect,
    });
    return rows.map(toCard);
  }

  private async trendingIds(now: Date): Promise<number[]> {
    const since = new Date(now.getTime() - TRENDING_DAYS * DAY_MS);
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT m.id_movie AS id
      FROM movies m
      JOIN episodes e ON e.movie_id = m.id_movie
      JOIN watch_histories w ON w.episode_id = e.id_episode
      WHERE m.status = 'PUBLISHED'::movie_status
        AND w.created_at >= ${since}
      GROUP BY m.id_movie, m.published_at
      ORDER BY COUNT(DISTINCT w.user_id) DESC, m.published_at DESC, m.id_movie DESC
      LIMIT ${TRENDING_LIMIT}
    `;
    return rows.map((row) => Number(row.id));
  }

  private async byGenre(): Promise<HomeSections["byGenre"]> {
    // Một câu cho mọi thể loại. Chia câu theo thể loại sẽ vượt ngân sách SQL của trang chủ.
    const rows = await this.prisma.$queryRaw<
      {
        genre_id: number;
        genre_name: string;
        id: number;
        slug: string;
        title: string;
        poster_url: string | null;
        release_year: number;
        age_rating: MovieCard["ageRating"];
        type: MovieCard["type"];
        trailer_url: string | null;
      }[]
    >`
      SELECT genre_id, genre_name, id, slug, title, poster_url, release_year, age_rating, type, trailer_url
      FROM (
        SELECT
          g.id_genre AS genre_id,
          g.name AS genre_name,
          m.id_movie AS id,
          m.slug,
          m.title,
          m.poster_url,
          m.release_year,
          m.age_rating,
          m.type,
          m.trailer_url,
          ROW_NUMBER() OVER (PARTITION BY g.id_genre ORDER BY m.published_at DESC, m.id_movie DESC) AS rn
        FROM genres g
        JOIN movie_genres mg ON mg.genre_id = g.id_genre
        JOIN movies m ON m.id_movie = mg.movie_id
        WHERE m.status = 'PUBLISHED'::movie_status
      ) ranked
      WHERE rn <= ${GENRE_ROW_LIMIT}
      ORDER BY genre_name ASC, genre_id ASC, rn ASC
    `;
    const groups: HomeSections["byGenre"] = [];
    for (const row of rows) {
      const genreId = Number(row.genre_id);
      let group = groups.find((item) => item.genre.id === genreId);
      if (!group) {
        group = { genre: { id: genreId, name: row.genre_name }, items: [] };
        groups.push(group);
      }
      group.items.push(
        toCard({
          id: Number(row.id),
          slug: row.slug,
          title: row.title,
          posterUrl: row.poster_url,
          releaseYear: row.release_year,
          ageRating: row.age_rating,
          type: row.type,
          trailerUrl: row.trailer_url,
        }),
      );
    }
    return groups;
  }

  private async readTrendingIds(): Promise<number[] | null> {
    const raw = await this.redis.get(TRENDING_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.some((id) => !Number.isInteger(id))) return null;
      return parsed as number[];
    } catch {
      return null;
    }
  }

  private async storeTrendingIds(ids: number[]): Promise<number[]> {
    await this.redis.set(TRENDING_KEY, JSON.stringify(ids), TRENDING_TTL_SEC);
    return ids;
  }
}

function toCard(row: CardRow): MovieCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    posterUrl: row.posterUrl,
    releaseYear: row.releaseYear,
    ageRating: row.ageRating,
    type: row.type,
    trailerUrl: row.trailerUrl,
  };
}

function named(credits: { id: number; name: string; role: string }[], role: string): NamedRef[] {
  return credits.filter((credit) => credit.role === role).map(({ id, name }) => ({ id, name }));
}

function seasonsOf(episodes: EpisodeSummary[]): MovieDetail["seasons"] {
  const seasons: MovieDetail["seasons"] = [];
  for (const episode of episodes) {
    let season = seasons.find((item) => item.number === episode.seasonNumber);
    if (!season) {
      season = { number: episode.seasonNumber, episodes: [] };
      seasons.push(season);
    }
    season.episodes.push(episode);
  }
  return seasons;
}
