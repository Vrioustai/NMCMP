import type { PrismaService } from "../prisma/prisma.service";
import { RatingsService } from "./ratings.service";

const published = { id: 3, status: "PUBLISHED" };

function service(findFirst: jest.Mock, upsert: jest.Mock, aggregate: jest.Mock) {
  return new RatingsService({
    movie: { findFirst },
    rating: { upsert, aggregate },
  } as unknown as PrismaService);
}

describe("RatingsService", () => {
  it("overwrites the same score and returns the rounded average", async () => {
    const findFirst = jest.fn().mockResolvedValue(published);
    const upsert = jest.fn().mockResolvedValue({ score: 4 });
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { score: 4 }, _count: { score: 1 } })
      .mockResolvedValueOnce({ _sum: { score: 2 }, _count: { score: 1 } });
    const ratings = service(findFirst, upsert, aggregate);

    await expect(ratings.rate(7, 3, { score: 4 })).resolves.toEqual({
      ratingAverage: 4,
      ratingCount: 1,
    });
    await expect(ratings.rate(7, 3, { score: 2 })).resolves.toEqual({
      ratingAverage: 2,
      ratingCount: 1,
    });
    expect(upsert).toHaveBeenLastCalledWith({
      where: { userId_movieId: { userId: 7, movieId: 3 } },
      create: { userId: 7, movieId: 3, score: 2 },
      update: { score: 2 },
    });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("does not store a score for a draft", async () => {
    const upsert = jest.fn();
    const ratings = service(jest.fn().mockResolvedValue(null), upsert, jest.fn());
    await expect(ratings.rate(7, 9, { score: 5 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(upsert).not.toHaveBeenCalled();
  });
});
