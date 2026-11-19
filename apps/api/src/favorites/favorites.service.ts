import type { MovieCard, MovieUserState, Page } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { requirePublishedMovie } from "../catalog/catalog-access";
import { pageQuery, type PageQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async state(userId: number, movieId: number): Promise<MovieUserState> {
    const movie = await requirePublishedMovie(this.prisma, { id: movieId });
    const where = { userId_movieId: { userId, movieId: movie.id } };
    const [rating, favorite] = await Promise.all([
      this.prisma.rating.findUnique({ where }),
      this.prisma.favorite.findUnique({ where }),
    ]);
    return { myScore: rating?.score ?? null, isFavorite: favorite !== null };
  }

  async add(userId: number, movieId: number): Promise<void> {
    const movie = await requirePublishedMovie(this.prisma, { id: movieId });
    await this.prisma.favorite.upsert({
      where: { userId_movieId: { userId, movieId: movie.id } },
      create: { userId, movieId: movie.id },
      update: {},
    });
  }

  async remove(userId: number, movieId: number): Promise<void> {
    const movie = await requirePublishedMovie(this.prisma, { id: movieId });
    // Xóa khi chưa thích vẫn xong, để bấm lần hai không thành lỗi.
    await this.prisma.favorite.deleteMany({ where: { userId, movieId: movie.id } });
  }

  async list(
    userId: number,
    query: { page?: number; pageSize?: number },
  ): Promise<Page<MovieCard>> {
    const page = pageQuery(query);
    const where = { userId, movie: { status: "PUBLISHED" as const } };
    const [total, rows] = await Promise.all([
      this.prisma.favorite.count({ where }),
      this.prisma.favorite.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { movieId: "desc" }],
        skip: page.skip,
        take: page.take,
        include: { movie: true },
      }),
    ]);
    return { items: rows.map((row) => toCard(row.movie)), ...pageFields(page), total };
  }
}

function pageFields(page: PageQuery): Pick<Page<MovieCard>, "page" | "pageSize"> {
  return { page: page.page, pageSize: page.pageSize };
}

function toCard(movie: {
  id: number;
  slug: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number;
  ageRating: MovieCard["ageRating"];
  type: MovieCard["type"];
  trailerUrl: string | null;
}): MovieCard {
  return {
    id: movie.id,
    slug: movie.slug,
    title: movie.title,
    posterUrl: movie.posterUrl,
    releaseYear: movie.releaseYear,
    ageRating: movie.ageRating,
    type: movie.type,
    trailerUrl: movie.trailerUrl,
  };
}
