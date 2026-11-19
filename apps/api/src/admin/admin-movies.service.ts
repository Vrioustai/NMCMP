import {
  PAGE_SIZE_DEFAULT,
  type AdminMovie,
  type AdminMovieDetail,
  type AdminMovieList,
  type MovieStatus,
  type NamedRef,
} from "@movie/contracts";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../common/app-error";
import { mediaRelative, MediaStorage } from "../media/media-storage";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminMovieQueryDto, CreateMovieDto, UpdateMovieDto } from "./admin-movies.dto";

type Tx = Prisma.TransactionClient;

const detailInclude = {
  genres: { include: { genre: true } },
  countries: { include: { country: true } },
  credits: { include: { person: true } },
  episodes: {
    orderBy: [{ seasonNumber: "asc" as const }, { number: "asc" as const }],
    select: {
      id: true,
      seasonNumber: true,
      number: true,
      title: true,
      streamUid: true,
      durationSec: true,
      subtitles: { select: { url: true } },
    },
  },
} satisfies Prisma.MovieInclude;

type MovieRow = Prisma.MovieGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class AdminMoviesService {
  private readonly logger = new Logger(AdminMoviesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  async list(query: AdminMovieQueryDto): Promise<AdminMovieList> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? PAGE_SIZE_DEFAULT;
    const text = query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { slug: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const where = { ...text, ...(query.status ? { status: query.status } : {}) };
    const [total, rows, all, draft, published] = await Promise.all([
      this.prisma.movie.count({ where }),
      this.prisma.movie.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          posterUrl: true,
          releaseYear: true,
          ageRating: true,
          type: true,
          status: true,
        },
      }),
      this.prisma.movie.count({ where: text }),
      this.prisma.movie.count({ where: { ...text, status: "DRAFT" } }),
      this.prisma.movie.count({ where: { ...text, status: "PUBLISHED" } }),
    ]);
    const counts = await this.episodeCounts(rows.map((row) => row.id));
    const items: AdminMovie[] = rows.map((row) => ({
      ...row,
      episodeCount: counts.get(row.id)?.episodeCount ?? 0,
      episodesWithStream: counts.get(row.id)?.episodesWithStream ?? 0,
    }));
    return { items, page, pageSize, total, counts: { all, draft, published } };
  }

  async get(id: number): Promise<AdminMovieDetail> {
    const movie = await this.prisma.movie.findUnique({ where: { id }, include: detailInclude });
    if (!movie) throw new AppError("NOT_FOUND");
    return toDetail(movie);
  }

  async create(dto: CreateMovieDto): Promise<AdminMovieDetail> {
    const id = await this.prisma.$transaction(async (tx) => {
      await assertGenres(tx, dto.genreIds);
      const movie = await tx.movie.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          description: dto.description,
          type: dto.type,
          releaseYear: dto.releaseYear,
          ageRating: dto.ageRating,
          sourceUrl: dto.sourceUrl,
          license: dto.license,
          originalTitle: dto.originalTitle ?? null,
          trailerUrl: dto.trailerUrl ?? null,
          status: "DRAFT",
        },
      });
      await replaceGenres(tx, movie.id, dto.genreIds);
      await replaceCountries(tx, movie.id, dto.countries ?? []);
      await replaceCredits(tx, movie.id, dto.directors ?? [], dto.actors ?? []);
      if (dto.type === "MOVIE") await ensureFirstEpisode(tx, movie.id);
      return movie.id;
    });
    return this.get(id);
  }

  async update(id: number, dto: UpdateMovieDto): Promise<AdminMovieDetail> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.movie.findUnique({
        where: { id },
        select: { id: true, type: true },
      });
      if (!existing) throw new AppError("NOT_FOUND");
      if (dto.genreIds) await assertGenres(tx, dto.genreIds);
      const data = scalarChanges(dto);
      if (Object.keys(data).length > 0) await tx.movie.update({ where: { id }, data });
      if (dto.genreIds) await replaceGenres(tx, id, dto.genreIds);
      if (dto.countries) await replaceCountries(tx, id, dto.countries);
      if (dto.directors !== undefined || dto.actors !== undefined) {
        const credits = await tx.movieCredit.findMany({
          where: { movieId: id },
          include: { person: true },
        });
        const directors =
          dto.directors ??
          credits
            .filter((credit) => credit.role === "DIRECTOR")
            .map((credit) => credit.person.name);
        const actors =
          dto.actors ??
          credits.filter((credit) => credit.role === "ACTOR").map((credit) => credit.person.name);
        await replaceCredits(tx, id, directors, actors);
      }
      const type = dto.type ?? existing.type;
      if (type === "MOVIE") await ensureFirstEpisode(tx, id);
    });
    return this.get(id);
  }

  // Video trên nhà cung cấp giữ lại. Chỉ ghi uid, rồi xóa file local sau khi dòng phim đã xóa.
  async remove(id: number): Promise<void> {
    const movie = await this.prisma.movie.findUnique({ where: { id }, include: detailInclude });
    if (!movie) throw new AppError("NOT_FOUND");
    const streamUids = movie.episodes.flatMap((episode) =>
      episode.streamUid ? [episode.streamUid] : [],
    );
    const files = mediaFiles(movie);
    await this.prisma.movie.delete({ where: { id } });
    this.logger.log(`Đã xóa phim ${id}. stream_uid: ${streamUids.join(",")}`);
    for (const file of files) {
      try {
        await this.storage.remove(file);
      } catch {
        this.logger.warn(`Không xóa được file media của phim ${id}.`);
      }
    }
  }

  async setStatus(id: number, status: MovieStatus): Promise<AdminMovieDetail> {
    const movie = await this.prisma.movie.findUnique({
      where: { id },
      select: { id: true, posterUrl: true, episodes: { select: { streamUid: true } } },
    });
    if (!movie) throw new AppError("NOT_FOUND");
    if (status === "PUBLISHED") {
      const ready = movie.episodes.some((episode) => episode.streamUid);
      if (!movie.posterUrl || !ready) throw new AppError("PUBLISH_REQUIREMENTS_NOT_MET");
      await this.prisma.movie.update({
        where: { id },
        data: { status, publishedAt: new Date() },
      });
    } else {
      await this.prisma.movie.update({ where: { id }, data: { status: "DRAFT" } });
    }
    return this.get(id);
  }

  private async episodeCounts(
    ids: number[],
  ): Promise<Map<number, { episodeCount: number; episodesWithStream: number }>> {
    const counts = new Map<number, { episodeCount: number; episodesWithStream: number }>();
    if (ids.length === 0) return counts;
    const rows = await this.prisma.$queryRaw<
      { movie_id: number; episode_count: number; episodes_with_stream: number }[]
    >(Prisma.sql`
      SELECT movie_id,
             COUNT(*)::int AS episode_count,
             COUNT(stream_uid)::int AS episodes_with_stream
      FROM episodes
      WHERE movie_id IN (${Prisma.join(ids)})
      GROUP BY movie_id
    `);
    for (const row of rows) {
      counts.set(Number(row.movie_id), {
        episodeCount: Number(row.episode_count),
        episodesWithStream: Number(row.episodes_with_stream),
      });
    }
    return counts;
  }
}

function toDetail(movie: MovieRow): AdminMovieDetail {
  const byRole = (role: "DIRECTOR" | "ACTOR"): NamedRef[] =>
    movie.credits
      .filter((credit) => credit.role === role)
      .map((credit) => ({ id: credit.person.id, name: credit.person.name }))
      .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  return {
    id: movie.id,
    slug: movie.slug,
    title: movie.title,
    posterUrl: movie.posterUrl,
    releaseYear: movie.releaseYear,
    ageRating: movie.ageRating,
    type: movie.type,
    status: movie.status,
    episodeCount: movie.episodes.length,
    episodesWithStream: movie.episodes.filter((episode) => episode.streamUid).length,
    originalTitle: movie.originalTitle,
    description: movie.description,
    backdropUrl: movie.backdropUrl,
    trailerUrl: movie.trailerUrl,
    sourceUrl: movie.sourceUrl,
    license: movie.license,
    publishedAt: movie.publishedAt ? movie.publishedAt.toISOString() : null,
    genres: movie.genres
      .map((link) => ({ id: link.genre.id, name: link.genre.name }))
      .sort((left, right) => left.id - right.id),
    countries: movie.countries
      .map((link) => ({ id: link.country.id, name: link.country.name }))
      .sort((left, right) => left.name.localeCompare(right.name, "vi")),
    directors: byRole("DIRECTOR"),
    actors: byRole("ACTOR"),
    episodes: movie.episodes.map((episode) => ({
      id: episode.id,
      seasonNumber: episode.seasonNumber,
      number: episode.number,
      title: episode.title,
      streamUid: episode.streamUid,
      durationSec: episode.durationSec,
      subtitleUrl: episode.subtitles[0]?.url ?? null,
    })),
  };
}

function scalarChanges(dto: UpdateMovieDto): Prisma.MovieUpdateInput {
  const data: Prisma.MovieUpdateInput = {};
  if (dto.title !== undefined) data.title = dto.title;
  if (dto.slug !== undefined) data.slug = dto.slug;
  if (dto.description !== undefined) data.description = dto.description;
  if (dto.type !== undefined) data.type = dto.type;
  if (dto.releaseYear !== undefined) data.releaseYear = dto.releaseYear;
  if (dto.ageRating !== undefined) data.ageRating = dto.ageRating;
  if (dto.sourceUrl !== undefined) data.sourceUrl = dto.sourceUrl;
  if (dto.license !== undefined) data.license = dto.license;
  if (dto.originalTitle !== undefined) data.originalTitle = dto.originalTitle;
  if (dto.trailerUrl !== undefined) data.trailerUrl = dto.trailerUrl;
  return data;
}

async function assertGenres(tx: Tx, genreIds: number[]): Promise<void> {
  const ids = [...new Set(genreIds)];
  const found = await tx.genre.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== ids.length) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "genreIds", message: "Thể loại không có trong danh sách" },
    ]);
  }
}

async function replaceGenres(tx: Tx, movieId: number, genreIds: number[]): Promise<void> {
  const ids = [...new Set(genreIds)];
  await tx.movieGenre.deleteMany({ where: { movieId } });
  await tx.movieGenre.createMany({ data: ids.map((genreId) => ({ movieId, genreId })) });
}

async function replaceCountries(tx: Tx, movieId: number, names: string[]): Promise<void> {
  const ids: number[] = [];
  for (const name of uniqueNames(names)) {
    const existing = await tx.country.findUnique({ where: { name } });
    const country = existing ?? (await tx.country.create({ data: { name } }));
    ids.push(country.id);
  }
  await tx.movieCountry.deleteMany({ where: { movieId } });
  if (ids.length > 0) {
    await tx.movieCountry.createMany({ data: ids.map((countryId) => ({ movieId, countryId })) });
  }
}

async function replaceCredits(
  tx: Tx,
  movieId: number,
  directors: string[],
  actors: string[],
): Promise<void> {
  await tx.movieCredit.deleteMany({ where: { movieId } });
  const rows: { movieId: number; personId: number; role: "DIRECTOR" | "ACTOR" }[] = [];
  for (const name of uniqueNames(directors)) {
    rows.push({ movieId, personId: await personId(tx, name), role: "DIRECTOR" });
  }
  for (const name of uniqueNames(actors)) {
    rows.push({ movieId, personId: await personId(tx, name), role: "ACTOR" });
  }
  if (rows.length > 0) await tx.movieCredit.createMany({ data: rows });
}

async function personId(tx: Tx, name: string): Promise<number> {
  const found = await tx.person.findFirst({ where: { name }, select: { id: true } });
  if (found) return found.id;
  const created = await tx.person.create({ data: { name }, select: { id: true } });
  return created.id;
}

// Phim lẻ luôn có tập 1. Phim bộ để trống cho đến khi quản trị thêm tập.
async function ensureFirstEpisode(tx: Tx, movieId: number): Promise<void> {
  const count = await tx.episode.count({ where: { movieId } });
  if (count > 0) return;
  await tx.episode.create({ data: { movieId, seasonNumber: 1, number: 1 } });
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

function mediaFiles(movie: MovieRow): string[] {
  const urls = [
    movie.posterUrl,
    movie.backdropUrl,
    ...movie.episodes.flatMap((episode) => episode.subtitles.map((subtitle) => subtitle.url)),
  ];
  const files = new Set<string>();
  for (const url of urls) {
    const relative = mediaRelative(url);
    if (relative) files.add(relative);
  }
  return [...files];
}
