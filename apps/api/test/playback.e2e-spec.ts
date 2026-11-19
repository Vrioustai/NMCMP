import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { Clock } from "../src/common/clock";
import type { ApiEnv } from "../src/config/env.schema";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Playback", () => {
  let app: INestApplication;
  let young = "";
  let adult = "";
  let admin = "";
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
    const editor = await account(2000, "Quản trị");
    admin = editor.cookie;
    await app.get(PrismaService).user.update({ where: { id: editor.id }, data: { role: "ADMIN" } });
  });

  afterAll(async () => {
    await app.get(PrismaService).movie.deleteMany({ where: { slug: { startsWith: "b20-" } } });
    await app.close();
  });

  it("TEST_UC07_01 rejects a guest", async () => {
    const episodeId = await publishedEpisode("b20-khach", "T16", "b20-khach");
    const response = await request(app.getHttpServer()).get(`/api/episodes/${episodeId}/playback`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("TEST_UC07_06 blocks a 17-year-old on T18 and lets an 18-year-old play", async () => {
    const episodeId = await publishedEpisode("b20-tuoi-18", "T18", "b20-tuoi-18");

    const blocked = await request(app.getHttpServer())
      .get(`/api/episodes/${episodeId}/playback`)
      .set("Cookie", young);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("AGE_RESTRICTED");

    const allowed = await request(app.getHttpServer())
      .get(`/api/episodes/${episodeId}/playback`)
      .set("Cookie", adult);
    expect(allowed.status).toBe(200);
    expect(allowed.body.episodeId).toBe(episodeId);
    expect(allowed.body.hlsUrl).toBe(fakeHlsUrl());
    expect(Date.parse(allowed.body.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("TEST_UC07_08 returns an already expired link when the provider marks the video expired", async () => {
    const episodeId = await publishedEpisode("b20-het-han", "P", "expired:b20-het-han");
    const response = await request(app.getHttpServer())
      .get(`/api/episodes/${episodeId}/playback`)
      .set("Cookie", adult);
    expect(response.status).toBe(200);
    expect(response.body.hlsUrl).toBe(fakeHlsUrl());
    expect(Date.parse(response.body.expiresAt)).toBeLessThan(Date.now());
    expect(JSON.stringify(response.body)).not.toContain("PRIVATE KEY");
  });

  it("hides a draft from an admin, a missing video, and offers resume plus the next episode", async () => {
    const prisma = app.get(PrismaService);
    const draft = await prisma.movie.create({
      data: movieData("b20-nhap", "T18", "DRAFT", [{ streamUid: "b20-nhap", durationSec: 90 }]),
      include: { episodes: true },
    });
    const draftId = draft.episodes[0]?.id ?? 0;
    const asAdmin = await request(app.getHttpServer())
      .get(`/api/episodes/${draftId}/playback`)
      .set("Cookie", admin);
    expect(asAdmin.status).toBe(404);
    expect(asAdmin.body.error.code).toBe("NOT_FOUND");

    const bare = await publishedEpisode("b20-chua-video", "T16", null);
    const missingVideo = await request(app.getHttpServer())
      .get(`/api/episodes/${bare}/playback`)
      .set("Cookie", adult);
    expect(missingVideo.status).toBe(404);

    const youngOnBareT18 = await prisma.movie.create({
      data: movieData("b20-thieu-video-t18", "T18", "PUBLISHED", [
        { streamUid: null, durationSec: 90 },
      ]),
      include: { episodes: true },
    });
    const ageFirst = await request(app.getHttpServer())
      .get(`/api/episodes/${youngOnBareT18.episodes[0]?.id}/playback`)
      .set("Cookie", young);
    expect(ageFirst.status).toBe(403);
    expect(ageFirst.body.error.code).toBe("AGE_RESTRICTED");

    const series = await prisma.movie.create({
      data: movieData("b20-bo", "T16", "PUBLISHED", [
        {
          streamUid: "b20-s1e1",
          durationSec: 1200,
          subtitles: { create: { language: "vi", url: "/media/subtitles/b20-bo/s1e1.vi.vtt" } },
        },
        { streamUid: "b20-s1e2", durationSec: 40 },
        { seasonNumber: 2, number: 1, streamUid: "b20-s2e1", durationSec: 90 },
      ]),
      include: { episodes: { orderBy: [{ seasonNumber: "asc" }, { number: "asc" }] } },
    });
    const [first, second, third] = series.episodes;
    await prisma.watchHistory.create({
      data: { userId: adultId, episodeId: first?.id ?? 0, progressSec: 750 },
    });
    await prisma.watchHistory.create({
      data: { userId: adultId, episodeId: second?.id ?? 0, progressSec: 11 },
    });

    const opening = await request(app.getHttpServer())
      .get(`/api/episodes/${first?.id}/playback`)
      .set("Cookie", adult);
    expect(opening.status).toBe(200);
    expect(opening.body.resumeAtSec).toBe(750);
    expect(opening.body.nextEpisodeId).toBe(second?.id);
    expect(opening.body.subtitles).toEqual([
      { language: "vi", label: "Tiếng Việt", url: "/media/subtitles/b20-bo/s1e1.vi.vtt" },
    ]);
    const ttl = app.get(ConfigService<ApiEnv, true>).getOrThrow("PLAYBACK_TOKEN_TTL_SEC");
    const expiresAt = Date.parse(opening.body.expiresAt);
    expect(expiresAt).toBeGreaterThan(Date.now() + (ttl - 15) * 1000);
    expect(expiresAt).toBeLessThan(Date.now() + (ttl + 15) * 1000);

    const nearEnd = await request(app.getHttpServer())
      .get(`/api/episodes/${second?.id}/playback`)
      .set("Cookie", adult);
    expect(nearEnd.status).toBe(200);
    expect(nearEnd.body.resumeAtSec).toBeUndefined();
    expect(nearEnd.body.nextEpisodeId).toBe(third?.id);

    const last = await request(app.getHttpServer())
      .get(`/api/episodes/${third?.id}/playback`)
      .set("Cookie", adult);
    expect(last.body.nextEpisodeId).toBeNull();
  });

  async function account(
    birthYear: number,
    displayName: string,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b20-${birthYear}-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName,
      birthYear,
    });
    expect(registered.status).toBe(201);
    return { cookie: sessionCookie(registered), id: registered.body.id as number };
  }

  async function publishedEpisode(
    slug: string,
    ageRating: "P" | "T16" | "T18",
    streamUid: string | null,
  ): Promise<number> {
    const movie = await app.get(PrismaService).movie.create({
      data: movieData(slug, ageRating, "PUBLISHED", [{ streamUid, durationSec: 600 }]),
      include: { episodes: true },
    });
    return movie.episodes[0]?.id ?? 0;
  }

  function movieData(
    slug: string,
    ageRating: "P" | "T16" | "T18",
    status: "DRAFT" | "PUBLISHED",
    episodes: {
      seasonNumber?: number;
      number?: number;
      streamUid: string | null;
      durationSec: number;
      subtitles?: { create: { language: string; url: string } };
    }[],
  ) {
    return {
      slug,
      title: `Phim ${slug}`,
      description: "Mô tả phim phát",
      type: episodes.length > 1 ? "SERIES" : "MOVIE",
      releaseYear: 2024,
      ageRating,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      sourceUrl: "https://example.com/phim",
      license: "Dùng cho bài test",
      episodes: {
        create: episodes.map((episode, index) => ({
          seasonNumber: episode.seasonNumber ?? 1,
          number: episode.number ?? index + 1,
          streamUid: episode.streamUid,
          durationSec: episode.durationSec,
          subtitles: episode.subtitles,
        })),
      },
    } as const;
  }

  function fakeHlsUrl(): string {
    return app.get(ConfigService<ApiEnv, true>).getOrThrow("FAKE_HLS_URL");
  }
});
