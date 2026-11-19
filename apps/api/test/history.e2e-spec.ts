import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { Clock } from "../src/common/clock";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";
const TWELVE_THIRTY = 12 * 60 + 30;

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Watch history", () => {
  let app: INestApplication;
  let young = "";
  let adult = "";
  let adultId = 0;
  const year = Clock.start().year();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const child = await account(year - 17, "Mười bảy");
    young = child.cookie;
    const grown = await account(year - 18, "Mười tám");
    adult = grown.cookie;
    adultId = grown.id;
  });

  afterAll(async () => {
    await app.get(PrismaService).movie.deleteMany({ where: { slug: { startsWith: "b21-" } } });
    await app.close();
  });

  it("TEST_UC07_05 stores 12:30 and the playback offer uses that point", async () => {
    const episodeId = await episodeOf("b21-xem-tiep", "T16", 1200);
    const saved = await request(app.getHttpServer())
      .put(`/api/me/history/${episodeId}`)
      .set("Cookie", adult)
      .send({ progressSec: TWELVE_THIRTY });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ episodeId, progressSec: TWELVE_THIRTY });

    const again = await request(app.getHttpServer())
      .put(`/api/me/history/${episodeId}`)
      .set("Cookie", adult)
      .send({ progressSec: TWELVE_THIRTY });
    expect(again.status).toBe(200);
    expect(await progressRows(episodeId)).toBe(1);

    const playback = await request(app.getHttpServer())
      .get(`/api/episodes/${episodeId}/playback`)
      .set("Cookie", adult);
    expect(playback.status).toBe(200);
    expect(playback.body.resumeAtSec).toBe(TWELVE_THIRTY);
  });

  it("TEST_UC13_01 lists one row per movie, newest first, and a series keeps its latest episode", async () => {
    const first = await episodeOf("b21-mot", "P", 600);
    const second = await episodeOf("b21-hai", "P", 600);
    const series = await seriesEpisodes();
    await put(first, 10);
    await put(second, 20);
    await put(series.first, 100);
    await put(series.second, 200);

    const page = await request(app.getHttpServer())
      .get("/api/me/history")
      .query({ pageSize: 2 })
      .set("Cookie", adult);
    expect(page.status).toBe(200);
    expect(page.body.total).toBe(4);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.items[0]).toMatchObject({
      movie: { slug: "b21-bo" },
      episode: { id: series.second, number: 2 },
      progressSec: 200,
    });
    expect(page.body.items[1].movie.slug).toBe("b21-hai");

    const rest = await request(app.getHttpServer())
      .get("/api/me/history")
      .query({ page: 2, pageSize: 2 })
      .set("Cookie", adult);
    expect(
      (rest.body.items as { movie: { slug: string } }[]).map((item) => item.movie.slug),
    ).toEqual(["b21-mot", "b21-xem-tiep"]);

    await put(series.first, 750);
    const latest = await request(app.getHttpServer())
      .get("/api/me/history")
      .query({ pageSize: 1 })
      .set("Cookie", adult);
    expect(latest.body.items[0]).toMatchObject({
      movie: { slug: "b21-bo" },
      episode: { id: series.first, number: 1 },
      progressSec: 750,
    });
  });

  it("rejects a draft, a T18 episode for a 17-year-old, a guest, and a bad progress", async () => {
    const prisma = app.get(PrismaService);
    const draft = await prisma.movie.create({
      data: movie("b21-nhap", "T16", "DRAFT", [{ durationSec: 90, streamUid: "b21-nhap" }]),
      include: { episodes: true },
    });
    const draftId = draft.episodes[0]?.id ?? 0;
    const hidden = await request(app.getHttpServer())
      .put(`/api/me/history/${draftId}`)
      .set("Cookie", adult)
      .send({ progressSec: 30 });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("NOT_FOUND");
    expect(await progressRows(draftId)).toBe(0);

    const adultOnly = await episodeOf("b21-tuoi-18", "T18", 600);
    const blocked = await request(app.getHttpServer())
      .put(`/api/me/history/${adultOnly}`)
      .set("Cookie", young)
      .send({ progressSec: 30 });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("AGE_RESTRICTED");
    expect(await progressRows(adultOnly)).toBe(0);

    const guest = await request(app.getHttpServer()).get("/api/me/history");
    expect(guest.status).toBe(401);
    const guestWrite = await request(app.getHttpServer())
      .put(`/api/me/history/${adultOnly}`)
      .send({ progressSec: 30 });
    expect(guestWrite.status).toBe(401);

    const bad = await request(app.getHttpServer())
      .put(`/api/me/history/${adultOnly}`)
      .set("Cookie", adult)
      .send({ progressSec: -1 });
    expect(bad.status).toBe(400);

    await prisma.movie.update({ where: { slug: "b21-mot" }, data: { status: "DRAFT" } });
    const listed = await request(app.getHttpServer()).get("/api/me/history").set("Cookie", adult);
    const slugs = (listed.body.items as { movie: { slug: string } }[]).map(
      (item) => item.movie.slug,
    );
    expect(slugs).not.toContain("b21-mot");
  });

  async function put(episodeId: number, progressSec: number): Promise<void> {
    const response = await request(app.getHttpServer())
      .put(`/api/me/history/${episodeId}`)
      .set("Cookie", adult)
      .send({ progressSec });
    expect(response.status).toBe(200);
  }

  async function account(
    birthYear: number,
    displayName: string,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b21-${birthYear}-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName,
      birthYear,
    });
    expect(registered.status).toBe(201);
    return { cookie: sessionCookie(registered), id: registered.body.id as number };
  }

  async function episodeOf(
    slug: string,
    ageRating: "P" | "T16" | "T18",
    durationSec: number,
  ): Promise<number> {
    const movieRow = await app.get(PrismaService).movie.create({
      data: movie(slug, ageRating, "PUBLISHED", [{ durationSec, streamUid: slug }]),
      include: { episodes: true },
    });
    return movieRow.episodes[0]?.id ?? 0;
  }

  async function seriesEpisodes(): Promise<{ first: number; second: number }> {
    const movieRow = await app.get(PrismaService).movie.create({
      data: movie("b21-bo", "T16", "PUBLISHED", [
        { durationSec: 1200, streamUid: "b21-bo-1" },
        { durationSec: 1200, streamUid: "b21-bo-2" },
      ]),
      include: { episodes: { orderBy: { number: "asc" } } },
    });
    return { first: movieRow.episodes[0]?.id ?? 0, second: movieRow.episodes[1]?.id ?? 0 };
  }

  async function progressRows(episodeId: number): Promise<number> {
    return app.get(PrismaService).watchHistory.count({ where: { userId: adultId, episodeId } });
  }

  function movie(
    slug: string,
    ageRating: "P" | "T16" | "T18",
    status: "DRAFT" | "PUBLISHED",
    episodes: { durationSec: number; streamUid: string }[],
  ) {
    return {
      slug,
      title: `Phim ${slug}`,
      description: "Mô tả lịch sử",
      type: episodes.length > 1 ? "SERIES" : "MOVIE",
      releaseYear: 2024,
      ageRating,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      sourceUrl: "https://example.com/phim",
      license: "Dùng cho bài test",
      episodes: {
        create: episodes.map((episode, index) => ({
          seasonNumber: 1,
          number: index + 1,
          durationSec: episode.durationSec,
          streamUid: episode.streamUid,
        })),
      },
    } as const;
  }
});
