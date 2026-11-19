import { Logger } from "@nestjs/common";
import { AppError } from "../common/app-error";
import { AdminMoviesService } from "./admin-movies.service";
import type { CreateMovieDto } from "./admin-movies.dto";

const input: CreateMovieDto = {
  title: "Phim",
  slug: "phim",
  description: "Mô tả",
  type: "MOVIE",
  releaseYear: 2024,
  ageRating: "P",
  genreIds: [1],
  sourceUrl: "https://example.com/phim",
  license: "Demo",
  countries: ["Việt Nam"],
  directors: ["Đạo Diễn"],
  actors: ["Diễn Viên"],
};

function detail() {
  return {
    id: 9,
    slug: "phim",
    title: "Phim",
    posterUrl: "/media/posters/a.webp",
    backdropUrl: "/media/backdrops/a.webp",
    releaseYear: 2024,
    ageRating: "P",
    type: "MOVIE",
    status: "DRAFT",
    originalTitle: null,
    description: "Mô tả",
    trailerUrl: null,
    sourceUrl: "https://example.com/phim",
    license: "Demo",
    publishedAt: null,
    genres: [{ genre: { id: 1, name: "Hài" } }],
    countries: [{ country: { id: 2, name: "Việt Nam" } }],
    credits: [
      { role: "DIRECTOR", person: { id: 3, name: "Đạo Diễn" } },
      { role: "ACTOR", person: { id: 4, name: "Diễn Viên" } },
    ],
    episodes: [
      {
        id: 1,
        seasonNumber: 1,
        number: 1,
        title: null,
        streamUid: "uid-1",
        durationSec: 90,
        subtitles: [{ url: "/media/subtitles/phim/s1e1.vi.vtt" }],
      },
    ],
  };
}

function harness() {
  const calls: string[] = [];
  const note = (name: string) =>
    jest.fn(async () => {
      calls.push(name);
    });
  const db = {
    movie: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([{ id: 9, title: "Phim", status: "DRAFT" }]),
      findUnique: jest.fn(),
      create: jest.fn(async () => {
        calls.push("movie.create");
        return { id: 9 };
      }),
      update: note("movie.update"),
      delete: note("movie.delete"),
    },
    genre: { findMany: jest.fn().mockResolvedValue([{ id: 1 }]) },
    movieGenre: { deleteMany: note("genres.delete"), createMany: note("genres.create") },
    country: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async () => {
        calls.push("country.create");
        return { id: 2 };
      }),
    },
    movieCountry: { deleteMany: note("countries.delete"), createMany: note("countries.create") },
    person: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async () => {
        calls.push("person.create");
        return { id: 3 };
      }),
    },
    movieCredit: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: note("credits.delete"),
      createMany: note("credits.create"),
    },
    episode: {
      count: jest.fn().mockResolvedValue(0),
      create: note("episode.create"),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ movie_id: 9, episode_count: 1, episodes_with_stream: 1 }]),
  };
  const prisma = {
    ...db,
    $transaction: jest.fn(async (work: (tx: typeof db) => Promise<unknown>) => work(db)),
  };
  const storage = { remove: note("file.remove") };
  const service = new AdminMoviesService(prisma as never, storage as never);
  return { service, prisma, calls };
}

describe("AdminMoviesService", () => {
  it("creates a single movie with episode 1 and leaves a series without episodes", async () => {
    const movie = harness();
    movie.prisma.movie.findUnique.mockResolvedValue(detail());
    await movie.service.create(input);
    expect(movie.calls).toContain("episode.create");

    const series = harness();
    series.prisma.movie.findUnique.mockResolvedValue(detail());
    await series.service.create({ ...input, type: "SERIES", slug: "bo" });
    expect(series.calls).not.toContain("episode.create");
  });

  it("rejects an unknown genre before writing the movie", async () => {
    const { service, prisma } = harness();
    prisma.genre.findMany.mockResolvedValue([]);
    await expect(service.create(input)).rejects.toBeInstanceOf(AppError);
    expect(prisma.movie.create).not.toHaveBeenCalled();
  });

  it("updates the title without replacing genres", async () => {
    const { service, prisma, calls } = harness();
    prisma.movie.findUnique
      .mockResolvedValueOnce({ id: 9, type: "MOVIE" })
      .mockResolvedValue(detail());
    prisma.episode.count.mockResolvedValue(1);
    await service.update(9, { title: "Tên mới" });
    expect(calls).toContain("movie.update");
    expect(calls).not.toContain("genres.delete");
  });

  it("refuses to publish without a poster or a streamed episode", async () => {
    const { service, prisma } = harness();
    prisma.movie.findUnique.mockResolvedValueOnce({ id: 9, posterUrl: null, episodes: [] });
    await expect(service.setStatus(9, "PUBLISHED")).rejects.toMatchObject({
      code: "PUBLISH_REQUIREMENTS_NOT_MET",
    });
    prisma.movie.findUnique.mockResolvedValueOnce({
      id: 9,
      posterUrl: "/media/posters/a.webp",
      episodes: [{ streamUid: null }],
    });
    await expect(service.setStatus(9, "PUBLISHED")).rejects.toMatchObject({
      code: "PUBLISH_REQUIREMENTS_NOT_MET",
    });
  });

  it("sets publishedAt when publishing and leaves it untouched when returning to draft", async () => {
    const { service, prisma } = harness();
    prisma.movie.findUnique
      .mockResolvedValueOnce({
        id: 9,
        posterUrl: "/media/posters/a.webp",
        episodes: [{ streamUid: "uid-1" }],
      })
      .mockResolvedValueOnce(detail())
      .mockResolvedValueOnce({ id: 9, posterUrl: null, episodes: [] })
      .mockResolvedValueOnce(detail());
    await service.setStatus(9, "PUBLISHED");
    expect(prisma.movie.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED", publishedAt: expect.any(Date) }),
      }),
    );
    await service.setStatus(9, "DRAFT");
    expect(prisma.movie.update).toHaveBeenLastCalledWith({
      where: { id: 9 },
      data: { status: "DRAFT" },
    });
  });

  it("logs stream uids and deletes media files only after the movie row is gone", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const { service, prisma, calls } = harness();
    prisma.movie.findUnique.mockResolvedValue(detail());
    await service.remove(9);
    expect(log.mock.calls.some((call) => String(call[0]).includes("uid-1"))).toBe(true);
    expect(calls.indexOf("movie.delete")).toBeLessThan(calls.indexOf("file.remove"));
    expect(calls.filter((call) => call === "file.remove")).toHaveLength(3);
    log.mockRestore();
  });

  it("counts episodes for the admin list with one grouped query", async () => {
    const { service, prisma } = harness();
    const page = await service.list({ q: "phim", page: 1, pageSize: 24 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(page.counts).toEqual({ all: 1, draft: 1, published: 1 });
    expect(page.items[0]).toMatchObject({ episodeCount: 1, episodesWithStream: 1 });
  });
});
