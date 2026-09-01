import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MoviesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query?: string) {
    const items = await this.prisma.movie.findMany({
      where: query ? { title: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, slug: true, title: true, posterUrl: true, releaseYear: true, rating: true },
    });
    return { items, query: query ?? null, nextCursor: null };
  }
}
