import type { PrismaService } from "../prisma/prisma.service";
import { FavoritesService } from "./favorites.service";

describe("FavoritesService", () => {
  it("returns the viewer's score and favorite flag", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 3, status: "PUBLISHED" });
    const ratingFind = jest.fn().mockResolvedValue({ score: 4 });
    const favoriteFind = jest.fn().mockResolvedValue({ userId: 7, movieId: 3 });
    const favorites = new FavoritesService({
      movie: { findFirst },
      rating: { findUnique: ratingFind },
      favorite: { findUnique: favoriteFind },
    } as unknown as PrismaService);

    await expect(favorites.state(7, 3)).resolves.toEqual({ myScore: 4, isFavorite: true });

    ratingFind.mockResolvedValueOnce(null);
    favoriteFind.mockResolvedValueOnce(null);
    await expect(favorites.state(7, 3)).resolves.toEqual({ myScore: null, isFavorite: false });

    findFirst.mockResolvedValueOnce(null);
    await expect(favorites.state(7, 9)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stores one favorite, lists published movies, and removes without an error", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 3, status: "PUBLISHED" });
    const upsert = jest.fn().mockResolvedValue({});
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const count = jest.fn().mockResolvedValue(1);
    const findMany = jest.fn().mockResolvedValue([
      {
        movie: {
          id: 3,
          slug: "mot",
          title: "Một",
          posterUrl: null,
          releaseYear: 2024,
          ageRating: "P",
          type: "MOVIE",
          trailerUrl: null,
        },
      },
    ]);
    const favorites = new FavoritesService({
      movie: { findFirst },
      favorite: { upsert, deleteMany, count, findMany },
    } as unknown as PrismaService);

    await favorites.add(7, 3);
    await favorites.add(7, 3);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_movieId: { userId: 7, movieId: 3 } },
      create: { userId: 7, movieId: 3 },
      update: {},
    });

    await expect(favorites.list(7, { page: 1, pageSize: 24 })).resolves.toMatchObject({
      total: 1,
      items: [{ id: 3, slug: "mot", title: "Một" }],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, movie: { status: "PUBLISHED" } },
        orderBy: [{ createdAt: "desc" }, { movieId: "desc" }],
      }),
    );

    await favorites.remove(7, 3);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 7, movieId: 3 } });

    findFirst.mockResolvedValueOnce(null);
    await expect(favorites.add(7, 9)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
