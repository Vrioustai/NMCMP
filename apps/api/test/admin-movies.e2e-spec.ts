import { stat } from "fs/promises";
import path from "path";
import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MediaStorage } from "../src/media/media-storage";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Admin movies", () => {
  let app: INestApplication;
  let admin = "";
  const files: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    admin = await account(true);
  });

  afterEach(async () => {
    const prisma = app.get(PrismaService);
    const storage = app.get(MediaStorage);
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "b13-" } } });
    for (const file of files) {
      await storage.remove(file).catch(() => undefined);
    }
    files.length = 0;
    await prisma.genre.deleteMany({ where: { name: { startsWith: "b13-" } } });
    await prisma.country.deleteMany({ where: { name: { startsWith: "b13-" } } });
    await prisma.person.deleteMany({ where: { name: { startsWith: "b13-" } } });
  });

  afterAll(async () => {
    await app.close();
  });

  it("TEST_UC14_01 creates a draft and gives a single movie its first episode", async () => {
    const stamp = Date.now();
    const genre = await genreNamed(`b13-hai-${stamp}`);
    const created = await request(app.getHttpServer())
      .post("/api/admin/movies")
      .set("Cookie", admin)
      .send(movieBody(`b13-le-${stamp}`, [genre.id], { type: "MOVIE" }));

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: "DRAFT",
      type: "MOVIE",
      episodeCount: 1,
      episodesWithStream: 0,
      publishedAt: null,
    });
    const episode = await app.get(PrismaService).episode.findFirst({
      where: { movieId: created.body.id },
    });
    expect(episode).toMatchObject({ seasonNumber: 1, number: 1, streamUid: null });

    const list = await request(app.getHttpServer())
      .get("/api/admin/movies")
      .query({ q: `b13-le-${stamp}` })
      .set("Cookie", admin);
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({ slug: `b13-le-${stamp}`, status: "DRAFT", episodeCount: 1 }),
    ]);
    expect(list.body.counts.draft).toBeGreaterThanOrEqual(1);
  });

  it("TEST_UC14_02 keeps genres when only the title changes", async () => {
    const stamp = Date.now();
    const genre = await genreNamed(`b13-hanh-${stamp}`);
    const created = await createMovie(`b13-sua-${stamp}`, [genre.id]);
    const patched = await request(app.getHttpServer())
      .patch(`/api/admin/movies/${created.body.id}`)
      .set("Cookie", admin)
      .send({ title: "Tên đã sửa" });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe("Tên đã sửa");
    expect(patched.body.genres).toEqual([{ id: genre.id, name: genre.name }]);

    const loaded = await request(app.getHttpServer())
      .get(`/api/admin/movies/${created.body.id}`)
      .set("Cookie", admin);
    expect(loaded.status).toBe(200);
    expect(loaded.body.title).toBe("Tên đã sửa");
    expect(loaded.body.genres).toEqual([{ id: genre.id, name: genre.name }]);
  });

  it("TEST_UC15_02 attaches two genres so each genre still finds the movie", async () => {
    const stamp = Date.now();
    const first = await genreNamed(`b13-mot-${stamp}`);
    const second = await genreNamed(`b13-hai-nua-${stamp}`);
    const created = await createMovie(`b13-hai-the-loai-${stamp}`, [first.id, second.id]);
    expect(created.body.genres.map((genre: { id: number }) => genre.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    const prisma = app.get(PrismaService);
    for (const genreId of [first.id, second.id]) {
      const found = await prisma.movie.count({
        where: { id: created.body.id, genres: { some: { genreId } } },
      });
      expect(found).toBe(1);
    }
  });

  it("TEST_UC14_05 hides a draft, publishes when ready, and keeps the old published time", async () => {
    const stamp = Date.now();
    const title = `B13 hiện ${stamp}`;
    const genre = await genreNamed(`b13-cong-${stamp}`);
    const created = await request(app.getHttpServer())
      .post("/api/admin/movies")
      .set("Cookie", admin)
      .send({ ...movieBody(`b13-cong-${stamp}`, [genre.id]), title });
    expect(created.status).toBe(201);
    const id = created.body.id as number;

    expect(await publicSlugs(title)).not.toContain(`b13-cong-${stamp}`);
    const blocked = await request(app.getHttpServer())
      .patch(`/api/admin/movies/${id}/status`)
      .set("Cookie", admin)
      .send({ status: "PUBLISHED" });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("PUBLISH_REQUIREMENTS_NOT_MET");

    await app.get(PrismaService).movie.update({
      where: { id },
      data: { posterUrl: "/media/posters/b13.webp" },
    });
    await app.get(PrismaService).episode.updateMany({
      where: { movieId: id },
      data: { streamUid: `b13-stream-${stamp}` },
    });

    const published = await request(app.getHttpServer())
      .patch(`/api/admin/movies/${id}/status`)
      .set("Cookie", admin)
      .send({ status: "PUBLISHED" });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("PUBLISHED");
    expect(typeof published.body.publishedAt).toBe("string");
    expect(await publicSlugs(title)).toContain(`b13-cong-${stamp}`);

    const old = new Date("2020-01-01T00:00:00.000Z");
    await app.get(PrismaService).movie.update({ where: { id }, data: { publishedAt: old } });
    const draft = await request(app.getHttpServer())
      .patch(`/api/admin/movies/${id}/status`)
      .set("Cookie", admin)
      .send({ status: "DRAFT" });
    expect(draft.status).toBe(200);
    expect(draft.body.publishedAt).toBe(old.toISOString());
    expect(await publicSlugs(title)).not.toContain(`b13-cong-${stamp}`);

    const again = await request(app.getHttpServer())
      .patch(`/api/admin/movies/${id}/status`)
      .set("Cookie", admin)
      .send({ status: "PUBLISHED" });
    expect(again.status).toBe(200);
    expect(again.body.publishedAt).not.toBe(old.toISOString());
    expect(await publicSlugs(title)).toContain(`b13-cong-${stamp}`);
  });

  it("TEST_UC14_03 deletes the movie chain and logs stream uids before removing files", async () => {
    const stamp = Date.now();
    const genre = await genreNamed(`b13-xoa-${stamp}`);
    const created = await createMovie(`b13-xoa-${stamp}`, [genre.id], {
      countries: [`b13-nuoc-${stamp}`],
      directors: [`b13-dao-${stamp}`],
    });
    const id = created.body.id as number;
    const prisma = app.get(PrismaService);
    const episode = await prisma.episode.findFirstOrThrow({ where: { movieId: id } });
    const user = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await prisma.episode.update({ where: { id: episode.id }, data: { streamUid: `uid-${stamp}` } });
    const poster = "posters/b13-xoa.webp";
    const subtitle = `subtitles/b13-xoa-${stamp}/s1e1.vi.vtt`;
    files.push(poster, subtitle);
    const storage = app.get(MediaStorage);
    await storage.save(poster, Buffer.from("poster"));
    await storage.save(subtitle, Buffer.from("WEBVTT\n"));
    await prisma.movie.update({
      where: { id },
      data: { posterUrl: `/media/${poster}`, backdropUrl: null },
    });
    await prisma.subtitle.create({
      data: { episodeId: episode.id, language: "vi", url: `/media/${subtitle}` },
    });
    const danmaku = await prisma.danmaku.create({
      data: { episodeId: episode.id, userId: user.id, content: "xin chào", timeMs: 1000 },
    });
    await prisma.report.create({
      data: { reporterUserId: user.id, danmakuId: danmaku.id, reason: "thử xóa" },
    });
    await prisma.comment.create({
      data: { movieId: id, userId: user.id, content: "bình luận" },
    });
    await prisma.rating.create({ data: { movieId: id, userId: user.id, score: 4 } });
    await prisma.favorite.create({ data: { movieId: id, userId: user.id } });
    await prisma.watchHistory.create({ data: { episodeId: episode.id, userId: user.id } });

    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    let response: request.Response;
    let logged = "";
    try {
      response = await request(app.getHttpServer())
        .delete(`/api/admin/movies/${id}`)
        .set("Cookie", admin);
      logged = log.mock.calls.map((call) => String(call[0])).join("\n");
    } finally {
      log.mockRestore();
    }
    expect(response.status).toBe(204);
    expect(logged).toContain(`uid-${stamp}`);
    expect(await prisma.movie.count({ where: { id } })).toBe(0);
    expect(await prisma.episode.count({ where: { id: episode.id } })).toBe(0);
    expect(await prisma.danmaku.count({ where: { id: danmaku.id } })).toBe(0);
    expect(await prisma.report.count({ where: { danmakuId: danmaku.id } })).toBe(0);
    expect(await prisma.comment.count({ where: { movieId: id } })).toBe(0);
    expect(await prisma.rating.count({ where: { movieId: id } })).toBe(0);
    expect(await prisma.favorite.count({ where: { movieId: id } })).toBe(0);
    expect(await prisma.watchHistory.count({ where: { episodeId: episode.id } })).toBe(0);
    expect(await prisma.genre.count({ where: { id: genre.id } })).toBe(1);
    await expect(stat(path.join(storage.root, poster))).rejects.toHaveProperty("code", "ENOENT");
    await expect(stat(path.join(storage.root, subtitle))).rejects.toHaveProperty("code", "ENOENT");
  });

  it("rejects every admin movie route for a normal user and a guest", async () => {
    const user = await account(false);
    const checks = [
      request(app.getHttpServer()).get("/api/admin/movies"),
      request(app.getHttpServer()).post("/api/admin/movies").send({}),
      request(app.getHttpServer()).get("/api/admin/movies/1"),
      request(app.getHttpServer()).patch("/api/admin/movies/1").send({}),
      request(app.getHttpServer()).patch("/api/admin/movies/1/status").send({}),
      request(app.getHttpServer()).delete("/api/admin/movies/1"),
    ];
    for (const call of checks) {
      expect((await call).status).toBe(401);
    }
    const asUser = [
      request(app.getHttpServer()).get("/api/admin/movies").set("Cookie", user),
      request(app.getHttpServer()).post("/api/admin/movies").set("Cookie", user).send({}),
      request(app.getHttpServer()).get("/api/admin/movies/1").set("Cookie", user),
      request(app.getHttpServer()).patch("/api/admin/movies/1").set("Cookie", user).send({}),
      request(app.getHttpServer())
        .patch("/api/admin/movies/1/status")
        .set("Cookie", user)
        .send({}),
      request(app.getHttpServer()).delete("/api/admin/movies/1").set("Cookie", user),
    ];
    for (const call of asUser) {
      const response = await call;
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  });

  async function account(makeAdmin: boolean): Promise<string> {
    const email = `b13-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Quản trị",
      birthYear: 1998,
    });
    expect(registered.status).toBe(201);
    if (makeAdmin) {
      await app.get(PrismaService).user.update({ where: { email }, data: { role: "ADMIN" } });
    }
    return sessionCookie(registered);
  }

  async function genreNamed(name: string): Promise<{ id: number; name: string }> {
    return app.get(PrismaService).genre.create({ data: { name } });
  }

  function movieBody(slug: string, genreIds: number[], extra: Record<string, unknown> = {}) {
    return {
      title: `Phim ${slug}`,
      slug,
      description: "Mô tả phim thử",
      type: "MOVIE",
      releaseYear: 2024,
      ageRating: "T13",
      genreIds,
      sourceUrl: "https://example.com/phim",
      license: "Dùng cho bài test",
      ...extra,
    };
  }

  async function createMovie(
    slug: string,
    genreIds: number[],
    extra: Record<string, unknown> = {},
  ): Promise<request.Response> {
    const response = await request(app.getHttpServer())
      .post("/api/admin/movies")
      .set("Cookie", admin)
      .send(movieBody(slug, genreIds, extra));
    expect(response.status).toBe(201);
    return response;
  }

  async function publicSlugs(title: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).get("/api/movies").query({ q: title });
    expect(response.status).toBe(200);
    return (response.body.items as { slug: string }[]).map((item) => item.slug);
  }
});
