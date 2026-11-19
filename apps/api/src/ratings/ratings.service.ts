import type { RatingSummary } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { requirePublishedMovie } from "../catalog/catalog-access";
import { PrismaService } from "../prisma/prisma.service";
import type { RateMovieDto } from "./ratings.dto";
import { ratingAverage } from "./rating-score";

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rate(userId: number, movieId: number, dto: RateMovieDto): Promise<RatingSummary> {
    const movie = await requirePublishedMovie(this.prisma, { id: movieId });
    // Chấm lại ghi đè cùng một dòng, không thêm bản ghi mới.
    await this.prisma.rating.upsert({
      where: { userId_movieId: { userId, movieId: movie.id } },
      create: { userId, movieId: movie.id, score: dto.score },
      update: { score: dto.score },
    });
    const total = await this.prisma.rating.aggregate({
      where: { movieId: movie.id },
      _sum: { score: true },
      _count: { score: true },
    });
    const count = total._count.score;
    return {
      ratingAverage: ratingAverage(total._sum.score ?? 0, count) ?? 0,
      ratingCount: count,
    };
  }
}
