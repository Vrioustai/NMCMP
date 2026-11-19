import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { addDays, vietnamDay } from "../src/admin/stats-range";
import { configureApp } from "../src/main";
import { seedDev } from "../prisma/fixtures/dev";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";
const BOUNDARY = new Date("2019-12-31T17:30:00.000Z");

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Admin stats", () => {
  let app: INestApplication;
  let admin = "";
  let mediaDir = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    mediaDir = await mkdtemp(path.join(tmpdir(), "fgz-b30-"));
    const editor = await register(app, "Quản trị B30");
    admin = editor.cookie;
    await app.get(PrismaService).user.update({
      where: { id: editor.id },
      data: { role: "ADMIN", createdAt: new Date("2019-01-01T00:00:00.000Z") },
    });
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.bannedWord.deleteMany({
      where: { creator: { email: { endsWith: "@filmgenz.local" } } },
    });
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "b30-" } } });
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "phim-" } } });
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: { startsWith: "b30-" } }, { email: { endsWith: "@filmgenz.local" } }],
      },
    });
    await rm(mediaDir, { recursive: true, force: true });
    await app.close();
  });

  it("counts a midnight view on the Vietnam day and keeps the empty day at zero", async () => {
    const prisma = app.get(PrismaService);
    const viewer = await prisma.user.create({
      data: {
        email: `b30-${Date.now()}@filmgenz.test`,
        passwordHash: "hash",
        displayName: "Người xem B30",
        birthYear: 2000,
        createdAt: BOUNDARY,
      },
    });
    const movie = await prisma.movie.create({
      data: {
        slug: "b30-moc",
        title: "Phim mốc",
        description: "Mô tả",
        type: "MOVIE",
        releaseYear: 2020,
        ageRating: "P",
        status: "PUBLISHED",
        publishedAt: BOUNDARY,
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
      },
    });
    const episode = await prisma.episode.create({ data: { movieId: movie.id, number: 1 } });
    await prisma.watchHistory.create({
      data: { userId: viewer.id, episodeId: episode.id, progressSec: 5, createdAt: BOUNDARY },
    });
    await prisma.danmaku.create({
      data: {
        episodeId: episode.id,
        userId: viewer.id,
        content: "chao",
        timeMs: 0,
        createdAt: BOUNDARY,
      },
    });
    const comment = await prisma.danmaku.findFirstOrThrow({ where: { episodeId: episode.id } });
    await prisma.report.create({
      data: {
        reporterUserId: viewer.id,
        danmakuId: comment.id,
        reason: "Mốc",
        createdAt: BOUNDARY,
      },
    });

    const listed = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .query({ from: "2020-01-01", to: "2020-01-02" })
      .set("Cookie", admin);
    expect(listed.status).toBe(200);
    expect(listed.body.days).toEqual([
      expect.objectContaining({ day: "2020-01-01", newUsers: 1, views: 1, danmaku: 1, reports: 1 }),
      expect.objectContaining({ day: "2020-01-02", newUsers: 0, views: 0, danmaku: 0, reports: 0 }),
    ]);
    expect(listed.body.totals.views).toBe(1);
    expect(listed.body.topMovies).toEqual([expect.objectContaining({ slug: "b30-moc", views: 1 })]);

    const previous = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .query({ from: "2019-12-31", to: "2019-12-31" })
      .set("Cookie", admin);
    expect(previous.body.days).toEqual([
      expect.objectContaining({ day: "2019-12-31", newUsers: 0, views: 0, danmaku: 0, reports: 0 }),
    ]);
  });

  it("rejects 91 days and a guest", async () => {
    const today = vietnamDay(new Date());
    const span = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .query({ from: addDays(today, -90), to: today })
      .set("Cookie", admin);
    expect(span.status).toBe(400);
    expect(span.body.error.code).toBe("VALIDATION_FAILED");

    const guest = await request(app.getHttpServer()).get("/api/admin/stats");
    expect(guest.status).toBe(401);
  });

  it("TEST_UC18_01 matches the sample catalog for the last seven days", async () => {
    await seedDev(app.get(PrismaService), mediaDir);
    const today = vietnamDay(new Date());
    const listed = await request(app.getHttpServer())
      .get("/api/admin/stats")
      .query({ from: addDays(today, -6), to: today })
      .set("Cookie", admin);
    expect(listed.status).toBe(200);
    expect(listed.body.totals).toMatchObject({ views: 15, newUsers: 20, danmaku: 3, reports: 3 });
    expect(
      listed.body.topMovies.map((movie: { slug: string; views: number }) => [
        movie.slug,
        movie.views,
      ]),
    ).toEqual([
      ["phim-xu-huong-01", 15],
      ["phim-xu-huong-02", 14],
      ["phim-xu-huong-03", 13],
      ["phim-xu-huong-04", 12],
      ["phim-xu-huong-05", 11],
      ["phim-xu-huong-06", 10],
      ["phim-xu-huong-07", 9],
      ["phim-xu-huong-08", 8],
      ["phim-xu-huong-09", 7],
      ["phim-xu-huong-10", 6],
    ]);
    const yesterday = listed.body.days.find(
      (day: { day: string }) => day.day === addDays(today, -1),
    );
    expect(yesterday.views).toBe(15);
    expect(
      listed.body.days
        .filter((day: { day: string }) => day.day !== addDays(today, -1))
        .every((day: { views: number }) => day.views === 0),
    ).toBe(true);
  }, 120_000);
});

async function register(
  app: INestApplication,
  displayName: string,
): Promise<{ cookie: string; id: number }> {
  const email = `b30-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
  const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
    email,
    password: PASSWORD,
    displayName,
    birthYear: 1997,
  });
  expect(registered.status).toBe(201);
  return { cookie: sessionCookie(registered), id: registered.body.id as number };
}
