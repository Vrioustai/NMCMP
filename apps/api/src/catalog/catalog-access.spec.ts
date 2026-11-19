import { AppError } from "../common/app-error";
import {
  requirePublishedMovie,
  requireVisibleDanmaku,
  requireWatchableEpisode,
} from "./catalog-access";

describe("catalog access", () => {
  it("returns a published movie and hides a draft", async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 4, status: "PUBLISHED" })
      .mockResolvedValueOnce(null);
    const prisma = { movie: { findFirst } };

    await expect(requirePublishedMovie(prisma as never, { id: 4 })).resolves.toMatchObject({
      id: 4,
    });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 4, status: "PUBLISHED" } });

    await expect(requirePublishedMovie(prisma as never, { slug: "nhap" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(findFirst).toHaveBeenLastCalledWith({ where: { slug: "nhap", status: "PUBLISHED" } });
  });

  it("returns a visible comment and hides one that is removed or on a draft", async () => {
    const findFirst = jest.fn().mockResolvedValueOnce({ id: 9 }).mockResolvedValueOnce(null);
    const prisma = { danmaku: { findFirst } };

    await expect(requireVisibleDanmaku(prisma as never, 9)).resolves.toMatchObject({ id: 9 });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 9,
        isHidden: false,
        deletedAt: null,
        episode: { movie: { status: "PUBLISHED" } },
      },
    });
    await expect(requireVisibleDanmaku(prisma as never, 10)).rejects.toBeInstanceOf(AppError);
  });

  it("checks publication before age, then blocks a viewer under 18 on T18", async () => {
    const hidden = { id: 1, streamUid: null, movie: { status: "DRAFT", ageRating: "T18" } };
    const adultOnly = {
      id: 2,
      streamUid: null,
      movie: { status: "PUBLISHED", ageRating: "T18" },
    };
    const open = { id: 3, streamUid: "uid", movie: { status: "PUBLISHED", ageRating: "T16" } };
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(hidden)
      .mockResolvedValueOnce(adultOnly)
      .mockResolvedValueOnce(adultOnly)
      .mockResolvedValueOnce(open);
    const prisma = { episode: { findUnique } };
    const child = { birthYear: 2009, year: 2026 };
    const adult = { birthYear: 2008, year: 2026 };

    await expect(requireWatchableEpisode(prisma as never, 9, child)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(requireWatchableEpisode(prisma as never, 1, child)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(requireWatchableEpisode(prisma as never, 2, child)).rejects.toMatchObject({
      code: "AGE_RESTRICTED",
    });
    await expect(requireWatchableEpisode(prisma as never, 2, adult)).resolves.toMatchObject({
      id: 2,
    });
    await expect(requireWatchableEpisode(prisma as never, 3, child)).resolves.toMatchObject({
      id: 3,
    });
  });
});
