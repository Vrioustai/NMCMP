import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import { MoviesService } from "./movies.service";

function service(prisma: unknown, redis?: Partial<RedisService>) {
  return new MoviesService(
    prisma as PrismaService,
    {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      ...redis,
    } as RedisService,
  );
}

describe("MoviesService", () => {
  it("filters published movies with every condition and a stable order", async () => {
    const count = jest.fn().mockResolvedValue(1);
    const findMany = jest.fn().mockResolvedValue([{ id: 3, title: "Train" }]);
    const movies = service({ movie: { count, findMany } });

    await movies.list({
      q: "Train",
      genre: 2,
      country: 4,
      releaseYear: 2024,
      page: 1,
      pageSize: 24,
    });

    const where = {
      status: "PUBLISHED",
      releaseYear: 2024,
      genres: { some: { genreId: 2 } },
      countries: { some: { countryId: 4 } },
      OR: [
        { title: { contains: "Train", mode: "insensitive" } },
        { originalTitle: { contains: "Train", mode: "insensitive" } },
      ],
    };
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 24,
      }),
    );
  });

  it("hides a draft and keeps a cached trending id out when the movie is no longer public", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const findMany = jest.fn().mockResolvedValue([{ id: 2, title: "Còn" }]);
    const movies = service(
      { movie: { findFirst, findMany } },
      { get: jest.fn().mockResolvedValue("[8,2]"), set: jest.fn() },
    );

    await expect(movies.detail("nhap")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(movies.trending()).resolves.toEqual([expect.objectContaining({ id: 2 })]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [8, 2] }, status: "PUBLISHED" } }),
    );
  });

  it("computes trending from the database when Redis has no list", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: 5 }]);
    const findMany = jest.fn().mockResolvedValue([{ id: 5, title: "Mới xem" }]);
    const set = jest.fn().mockResolvedValue(false);
    const movies = service(
      { $queryRaw: queryRaw, movie: { findMany } },
      { get: jest.fn().mockResolvedValue(null), set },
    );

    await expect(movies.trending(new Date("2026-11-19T00:00:00.000Z"))).resolves.toEqual([
      expect.objectContaining({ id: 5 }),
    ]);
    expect(set).toHaveBeenCalledWith("movies:trending", "[5]", 600);
  });

  it("builds the detail, the home rows and an empty trend list", async () => {
    const movie = {
      id: 7,
      slug: "bo",
      title: "Bộ",
      posterUrl: null,
      releaseYear: 2024,
      ageRating: "T16",
      type: "SERIES",
      trailerUrl: null,
      originalTitle: null,
      description: "Mô tả",
      backdropUrl: null,
      sourceUrl: "https://example.com/bo",
      license: "Giấy",
      status: "PUBLISHED",
    };
    const queryRaw = jest.fn((parts: TemplateStringsArray) => {
      const text = parts.join(" ");
      if (text.includes("json_agg")) {
        return Promise.resolve([
          {
            genres: [{ id: 1, name: "Hài" }],
            countries: [{ id: 2, name: "Việt Nam" }],
            credits: [
              { id: 3, name: "Đạo", role: "DIRECTOR" },
              { id: 4, name: "Diễn", role: "ACTOR" },
            ],
            episodes: [
              { id: 8, seasonNumber: 1, number: 1, title: null, durationSec: 10 },
              { id: 9, seasonNumber: 1, number: 2, title: "Sau", durationSec: null },
              { id: 10, seasonNumber: 2, number: 1, title: "Mùa 2", durationSec: 20 },
            ],
            rating: { count: 2, sum: 9 },
          },
        ]);
      }
      if (text.includes("ROW_NUMBER")) {
        return Promise.resolve([row(1, "Hài", 7), row(1, "Hài", 8), row(2, "Tâm lý", 9)]);
      }
      return Promise.resolve([]);
    });
    const findMany = jest.fn().mockResolvedValue([movie]);
    const movies = service(
      {
        movie: { findFirst: jest.fn().mockResolvedValue(movie), findMany },
        genre: { findMany },
        country: { findMany },
        $queryRaw: queryRaw,
      },
      { get: jest.fn().mockResolvedValueOnce("nope").mockResolvedValueOnce("[1,true]") },
    );

    const detail = await movies.detail("bo");
    expect(detail.ratingAverage).toBe(4.5);
    expect(detail.directors).toEqual([{ id: 3, name: "Đạo" }]);
    expect(detail.actors).toEqual([{ id: 4, name: "Diễn" }]);
    expect(detail.seasons.map((season) => season.number)).toEqual([1, 2]);

    await expect(movies.trending()).resolves.toEqual([]);
    await expect(movies.trending()).resolves.toEqual([]);
    const home = await movies.home();
    expect(home.byGenre.map((group) => group.genre.name)).toEqual(["Hài", "Tâm lý"]);
    expect(home.byGenre[0]?.items).toHaveLength(2);
    expect(await movies.genres()).toEqual([movie]);
    expect(await movies.countries()).toEqual([movie]);
  });
});

function row(genreId: number, name: string, id: number) {
  return {
    genre_id: genreId,
    genre_name: name,
    id,
    slug: `phim-${id}`,
    title: name,
    poster_url: null,
    release_year: 2024,
    age_rating: "P" as const,
    type: "MOVIE" as const,
    trailer_url: null,
  };
}
