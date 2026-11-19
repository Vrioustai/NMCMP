import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { Clock } from "../src/common/clock";
import { seedDev } from "../prisma/fixtures/dev";

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) throw new Error("Thiếu DATABASE_URL_TEST.");

describe("Dev fixture", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  let media = "";

  beforeAll(async () => {
    media = await mkdtemp(path.join(tmpdir(), "filmgenz-dev-"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(media, { recursive: true, force: true });
  });

  it("fills the names from spec 8.3 and stays the same on a second run", async () => {
    await seedDev(prisma, media);
    await seedDev(prisma, media);

    const published = await prisma.movie.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    });
    expect(published).toHaveLength(30);
    expect(published.slice(0, 10).map((movie) => movie.title)).toEqual(
      Array.from(
        { length: 10 },
        (_item, index) => `Phim mới ${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(await prisma.movie.count({ where: { status: "DRAFT" } })).toBe(2);

    const series = await prisma.movie.findUnique({
      where: { slug: "phim-bo-mau-01" },
      include: { episodes: { orderBy: { number: "asc" }, include: { subtitles: true } } },
    });
    expect(series?.ageRating).toBe("T16");
    expect(series?.episodes).toHaveLength(3);
    expect(series?.episodes[0]?.durationSec).toBe(1200);
    expect(series?.episodes[0]?.subtitles[0]?.url).toBe(
      "/media/subtitles/phim-bo-mau-01/s1e1.vi.vtt",
    );
    expect(series?.episodes[1]?.subtitles).toHaveLength(1);
    const cue = await readFile(
      path.join(media, "subtitles", "phim-bo-mau-01", "s1e1.vi.vtt"),
      "utf8",
    );
    expect(cue).toContain("00:00:05.000");

    const sample = await prisma.movie.findUnique({
      where: { slug: "phim-mau-02" },
      include: { genres: { include: { genre: true } }, countries: { include: { country: true } } },
    });
    expect(sample?.releaseYear).toBe(2024);
    expect(sample?.genres.map((item) => item.genre.name)).toContain("Hành động");
    expect(sample?.countries.map((item) => item.country.name)).toContain("Hàn Quốc");
    expect(await prisma.movie.findUnique({ where: { slug: "phim-nhap-an-01" } })).toMatchObject({
      title: "Phim nháp ẩn 01",
      status: "DRAFT",
    });
    expect((await prisma.movie.findUnique({ where: { slug: "phim-nha-03" } }))?.title).toBe(
      "Phim nha 03",
    );
    expect((await prisma.movie.findUnique({ where: { slug: "phim-nha-04" } }))?.title).toBe(
      "Phim Nhà 04",
    );
    expect((await prisma.movie.findUnique({ where: { slug: "phim-tuoi-18" } }))?.ageRating).toBe(
      "T18",
    );

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await prisma.watchHistory.groupBy({
      by: ["episodeId"],
      where: { createdAt: { gte: weekAgo } },
      _count: { userId: true },
    });
    const episodes = await prisma.episode.findMany({
      where: { id: { in: recent.map((row) => row.episodeId) } },
      include: { movie: { select: { title: true, publishedAt: true } } },
    });
    const ranked = episodes
      .map((episode) => ({
        title: episode.movie.title,
        viewers: recent.find((row) => row.episodeId === episode.id)?._count.userId ?? 0,
        publishedAt: episode.movie.publishedAt?.getTime() ?? 0,
      }))
      .sort((left, right) => right.viewers - left.viewers || right.publishedAt - left.publishedAt);
    expect(ranked.slice(0, 10).every((item) => item.title.startsWith("Phim xu hướng"))).toBe(true);
    expect(ranked.some((item) => item.title.startsWith("Phim mới"))).toBe(false);
    const oldMovie = await prisma.movie.findUnique({
      where: { slug: "phim-xem-cu" },
      include: { episodes: { include: { watchHistories: true } } },
    });
    expect(oldMovie?.episodes[0]?.watchHistories.every((row) => row.createdAt < weekAgo)).toBe(
      true,
    );

    const danmaku = await prisma.danmaku.findMany({
      where: { episode: { movie: { slug: "phim-bo-mau-01" } } },
    });
    expect(danmaku.map((item) => item.timeMs)).toEqual([310000, 310000, 310000]);
    expect(await prisma.report.count({ where: { status: "PENDING" } })).toBe(3);
    expect(await prisma.bannedWord.count()).toBe(10);
    expect(await prisma.bannedWord.findUnique({ where: { word: "spamlink" } })).toBeTruthy();
    const year = Clock.start().year();
    expect(await prisma.user.findUnique({ where: { email: "u17@filmgenz.local" } })).toMatchObject({
      birthYear: year - 17,
    });
    expect(
      await prisma.user.findUnique({ where: { email: "locked@filmgenz.local" } }),
    ).toMatchObject({
      status: "LOCKED",
    });
    expect(
      await prisma.user.findUnique({ where: { email: "admin@filmgenz.local" } }),
    ).toMatchObject({
      role: "ADMIN",
    });
    expect(await prisma.movie.count()).toBe(32);
  }, 60_000);
});
