import type { AdminGenre } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateGenreDto, UpdateGenreDto } from "./admin-genres.dto";

@Injectable()
export class AdminGenresService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminGenre[]> {
    const [genres, counts] = await Promise.all([
      this.prisma.genre.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] }),
      this.prisma.movieGenre.groupBy({ by: ["genreId"], _count: true }),
    ]);
    const movieCount = new Map(counts.map((row) => [row.genreId, row._count]));
    return genres.map((genre) => ({
      id: genre.id,
      name: genre.name,
      movieCount: movieCount.get(genre.id) ?? 0,
    }));
  }

  async create(dto: CreateGenreDto): Promise<AdminGenre> {
    await this.assertUnique(dto.name);
    const genre = await this.prisma.genre.create({ data: { name: dto.name } });
    return { id: genre.id, name: genre.name, movieCount: 0 };
  }

  async update(id: number, dto: UpdateGenreDto): Promise<AdminGenre> {
    const current = await this.required(id);
    if (dto.name === undefined) return this.withCount(current);
    await this.assertUnique(dto.name, id);
    const genre = await this.prisma.genre.update({ where: { id }, data: { name: dto.name } });
    return this.withCount(genre);
  }

  async remove(id: number): Promise<void> {
    await this.required(id);
    const used = await this.prisma.movieGenre.count({ where: { genreId: id } });
    if (used > 0) throw new AppError("GENRE_IN_USE");
    await this.prisma.genre.delete({ where: { id } });
  }

  private async required(id: number): Promise<{ id: number; name: string }> {
    const genre = await this.prisma.genre.findUnique({ where: { id } });
    if (!genre) throw new AppError("NOT_FOUND");
    return genre;
  }

  // UNIQUE của Postgres vẫn phân biệt hoa thường, nên so trước khi ghi.
  private async assertUnique(name: string, exceptId?: number): Promise<void> {
    const taken = await this.prisma.genre.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (taken) throw new AppError("GENRE_TAKEN");
  }

  private async withCount(genre: { id: number; name: string }): Promise<AdminGenre> {
    const movieCount = await this.prisma.movieGenre.count({ where: { genreId: genre.id } });
    return { id: genre.id, name: genre.name, movieCount };
  }
}
