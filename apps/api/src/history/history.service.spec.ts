import type { UserProfile } from "@movie/contracts";
import { AppError } from "../common/app-error";
import type { PrismaService } from "../prisma/prisma.service";
import { HistoryService } from "./history.service";

const NOW = new Date("2026-06-15T03:00:00.000Z");

const viewer: UserProfile = {
  id: 5,
  email: "xem@filmgenz.test",
  displayName: "Xem",
  avatarUrl: null,
  birthYear: 2000,
  role: "USER",
};

function episode(extra: Record<string, unknown> = {}) {
  return {
    id: 12,
    movieId: 3,
    streamUid: "uid",
    movie: { status: "PUBLISHED", ageRating: "T16" },
    subtitles: [],
    ...extra,
  };
}

describe("HistoryService", () => {
  it("upserts one progress row and refuses a draft or an under-age viewer", async () => {
    const upsert = jest.fn().mockResolvedValue({ episodeId: 12, progressSec: 750 });
    const findUnique = jest.fn().mockResolvedValue(episode());
    const history = new HistoryService({
      episode: { findUnique },
      watchHistory: { upsert },
    } as unknown as PrismaService);

    await expect(history.save(viewer, 12, { progressSec: 750 }, NOW)).resolves.toEqual({
      episodeId: 12,
      progressSec: 750,
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_episodeId: { userId: 5, episodeId: 12 } },
      create: { userId: 5, episodeId: 12, progressSec: 750 },
      update: { progressSec: 750 },
    });

    findUnique.mockResolvedValueOnce(null);
    await expect(history.save(viewer, 9, { progressSec: 1 }, NOW)).rejects.toBeInstanceOf(AppError);
    expect(upsert).toHaveBeenCalledTimes(1);

    findUnique.mockResolvedValueOnce(episode({ movie: { status: "PUBLISHED", ageRating: "T18" } }));
    await expect(
      history.save({ ...viewer, birthYear: 2009 }, 12, { progressSec: 1 }, NOW),
    ).rejects.toMatchObject({ code: "AGE_RESTRICTED" });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("returns one row per movie from the latest watch", async () => {
    const queryRaw = jest.fn((parts: TemplateStringsArray) => {
      const text = parts.join(" ");
      if (text.includes("COUNT")) return Promise.resolve([{ total: 2 }]);
      return Promise.resolve([
        {
          movie_id: "8",
          slug: "bo",
          title: "Bộ",
          poster_url: null,
          release_year: 2024,
          age_rating: "T16",
          type: "SERIES",
          episode_id: 20,
          season_number: 1,
          episode_number: 2,
          episode_title: null,
          duration_sec: null,
          progress_sec: 200,
          watched_at: "2026-06-15T04:00:00.000Z",
        },
      ]);
    });
    const history = new HistoryService({ $queryRaw: queryRaw } as unknown as PrismaService);
    const page = await history.list(5, { page: 1, pageSize: 24 });

    expect(page.total).toBe(2);
    expect(page.items).toEqual([
      {
        movie: {
          id: 8,
          slug: "bo",
          title: "Bộ",
          posterUrl: null,
          releaseYear: 2024,
          ageRating: "T16",
          type: "SERIES",
        },
        episode: { id: 20, seasonNumber: 1, number: 2, title: null, durationSec: null },
        progressSec: 200,
        watchedAt: "2026-06-15T04:00:00.000Z",
      },
    ]);
    const listSql = queryRaw.mock.calls[1]?.[0].join(" ");
    expect(listSql).toContain("DISTINCT ON (e.movie_id)");
    expect(listSql).toContain("m.status = 'PUBLISHED'::movie_status");
  });

  it("returns an empty page when the count row is missing", async () => {
    const queryRaw = jest.fn((parts: TemplateStringsArray) => {
      const text = parts.join(" ");
      return Promise.resolve(text.includes("COUNT") ? [] : []);
    });
    const history = new HistoryService({ $queryRaw: queryRaw } as unknown as PrismaService);
    await expect(history.list(5, {})).resolves.toMatchObject({ items: [], total: 0, page: 1 });
  });
});
