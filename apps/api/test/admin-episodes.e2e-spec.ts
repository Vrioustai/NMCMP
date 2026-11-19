import { readdir, readFile } from "fs/promises";
import path from "path";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import sharp from "sharp";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { MediaStorage } from "../src/media/media-storage";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Admin episodes", () => {
  let app: INestApplication;
  let admin = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    admin = await account(true);
  });

  afterEach(async () => {
    const prisma = app.get(PrismaService);
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "b14-" } } });
    await prisma.genre.deleteMany({ where: { name: { startsWith: "b14-" } } });
  });

  afterAll(async () => {
    await app.close();
  });

  it("TEST_UC14_04 attaches a stream uid after the provider answers", async () => {
    const movie = await createMovie("MOVIE");
    const episodeId = movie.episodes[0].id as number;
    const failed = await request(app.getHttpServer())
      .put(`/api/admin/episodes/${episodeId}/stream`)
      .set("Cookie", admin)
      .send({ streamUid: "error:mat" });
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe("VIDEO_PROVIDER_ERROR");

    const stored = await app.get(PrismaService).episode.findUnique({ where: { id: episodeId } });
    expect(stored?.streamUid).toBeNull();

    const attached = await request(app.getHttpServer())
      .put(`/api/admin/episodes/${episodeId}/stream`)
      .set("Cookie", admin)
      .send({ streamUid: "local-demo" });
    expect(attached.status).toBe(200);
    expect(attached.body).toMatchObject({ streamUid: "local-demo", durationSec: 90 });
  });

  it("rejects a duplicate episode number and keeps a copied link out of the database", async () => {
    const movie = await createMovie("SERIES");
    const first = await request(app.getHttpServer())
      .post(`/api/admin/movies/${movie.id}/episodes`)
      .set("Cookie", admin)
      .send({ seasonNumber: 1, number: 1, title: "Tập một" });
    expect(first.status).toBe(201);
    const again = await request(app.getHttpServer())
      .post(`/api/admin/movies/${movie.id}/episodes`)
      .set("Cookie", admin)
      .send({ seasonNumber: 1, number: 1 });
    expect(again.status).toBe(409);

    const httpLink = await request(app.getHttpServer())
      .post(`/api/admin/episodes/${first.body.id}/stream-copy`)
      .set("Cookie", admin)
      .send({ url: "http://cdn.example/a.mp4" });
    const driveLink = await request(app.getHttpServer())
      .post(`/api/admin/episodes/${first.body.id}/stream-copy`)
      .set("Cookie", admin)
      .send({ url: "https://drive.google.com/file/d/abc" });
    expect(httpLink.status).toBe(400);
    expect(driveLink.status).toBe(400);

    const copied = await request(app.getHttpServer())
      .post(`/api/admin/episodes/${first.body.id}/stream-copy`)
      .set("Cookie", admin)
      .send({ url: "https://cdn.example/a.mp4" });
    expect(copied.status).toBe(201);
    expect(copied.body.streamUid).toBe(`fake-copy-${movie.slug}/s1e1`);
    const row = await app.get(PrismaService).episode.findUnique({ where: { id: first.body.id } });
    expect(row?.streamUid).toBeNull();

    const upload = await request(app.getHttpServer())
      .post(`/api/admin/episodes/${first.body.id}/stream-upload`)
      .set("Cookie", admin)
      .send({});
    expect(upload.status).toBe(201);
    expect(upload.body.uid).toBe(`fake-upload-${movie.slug}/s1e1`);
  });

  it("accepts a png named jpg, rejects text, and replaces a subtitle in place", async () => {
    const movie = await createMovie("MOVIE");
    const png = await sharp({
      create: { width: 8, height: 12, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const text = await request(app.getHttpServer())
      .post(`/api/admin/movies/${movie.id}/images/poster`)
      .set("Cookie", admin)
      .attach("file", Buffer.from("hello"), "poster.jpg");
    expect(text.status).toBe(400);

    const image = await request(app.getHttpServer())
      .post(`/api/admin/movies/${movie.id}/images/poster`)
      .set("Cookie", admin)
      .attach("file", png, "poster.jpg");
    expect(image.status).toBe(201);
    expect(image.body.posterUrl).toMatch(/^\/media\/posters\/b14-.*\.webp$/);
    const storage = app.get(MediaStorage);
    const saved = await sharp(
      await readFile(path.join(storage.root, image.body.posterUrl.slice("/media/".length))),
    ).metadata();
    expect(saved.format).toBe("webp");
    expect(saved.exif).toBeUndefined();

    const episodeId = movie.episodes[0].id as number;
    const bad = await request(app.getHttpServer())
      .put(`/api/admin/episodes/${episodeId}/subtitles/vi`)
      .set("Cookie", admin)
      .attach("file", Buffer.from("NOTE hello"), "phu-de.vtt");
    expect(bad.status).toBe(400);

    const first = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nMột\n";
    const second = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHai\n";
    const put = (body: string) =>
      request(app.getHttpServer())
        .put(`/api/admin/episodes/${episodeId}/subtitles/vi`)
        .set("Cookie", admin)
        .attach("file", Buffer.from(body), "phu-de.vtt");
    expect((await put(first)).status).toBe(200);
    const replaced = await put(second);
    expect(replaced.status).toBe(200);
    expect(replaced.body.url).toBe(`/media/subtitles/${movie.slug}/s1e1.vi.vtt`);
    const folder = path.join(storage.root, "subtitles", movie.slug);
    expect(await readdir(folder)).toEqual(["s1e1.vi.vtt"]);
    expect(await readFile(path.join(folder, "s1e1.vi.vtt"), "utf8")).toContain("Hai");

    const served = await request(app.getHttpServer()).get(replaced.body.url);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toMatch(/text\/vtt/);
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects episode routes for a guest and a normal user", async () => {
    const user = await account(false);
    const server = app.getHttpServer();
    const checks = [
      request(server).post("/api/admin/movies/1/episodes").send({ number: 1 }),
      request(server).patch("/api/admin/episodes/1").send({ title: "Tập" }),
      request(server).delete("/api/admin/episodes/1"),
      request(server).put("/api/admin/episodes/1/stream").send({ streamUid: "x" }),
      request(server).post("/api/admin/episodes/1/stream-upload").send({}),
      request(server)
        .post("/api/admin/episodes/1/stream-copy")
        .send({ url: "https://cdn.example/a.mp4" }),
      request(server).put("/api/admin/episodes/1/subtitles/vi"),
      request(server).delete("/api/admin/episodes/1/subtitles/vi"),
      request(server).post("/api/admin/movies/1/images/poster"),
    ];
    for (const call of checks) {
      expect((await call).status).toBe(401);
    }
    const forbidden = await request(server)
      .put("/api/admin/episodes/1/stream")
      .set("Cookie", user)
      .send({ streamUid: "x" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  async function account(makeAdmin: boolean): Promise<string> {
    const email = `b14-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Biên tập",
      birthYear: 1997,
    });
    expect(registered.status).toBe(201);
    if (makeAdmin) {
      await app.get(PrismaService).user.update({ where: { email }, data: { role: "ADMIN" } });
    }
    return sessionCookie(registered);
  }

  async function createMovie(type: "MOVIE" | "SERIES") {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const genre = await app.get(PrismaService).genre.create({ data: { name: `b14-${stamp}` } });
    const slug = `b14-${type.toLowerCase()}-${stamp}`;
    const created = await request(app.getHttpServer())
      .post("/api/admin/movies")
      .set("Cookie", admin)
      .send({
        title: `Phim ${slug}`,
        slug,
        description: "Mô tả tập",
        type,
        releaseYear: 2024,
        ageRating: "P",
        genreIds: [genre.id],
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
      });
    expect(created.status).toBe(201);
    const episodes = await app
      .get(PrismaService)
      .episode.findMany({ where: { movieId: created.body.id } });
    return { id: created.body.id as number, slug, episodes };
  }
});
