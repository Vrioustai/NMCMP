import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { DanmakuService } from "../src/danmaku/danmaku.service";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Admin moderation", () => {
  let app: INestApplication;
  let admin = "";
  let adminId = 0;
  let member = "";
  let memberId = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const editor = await account("Quản trị B29", true);
    admin = editor.cookie;
    adminId = editor.id;
    const viewer = await account("Người gửi B29", false);
    member = viewer.cookie;
    memberId = viewer.id;
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "b29-" } } });
    await prisma.bannedWord.deleteMany({ where: { word: { startsWith: "b29" } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "b29-" } } });
    await app.close();
  });

  it("TEST_UC17_01 hides, deletes, and warns three reports", async () => {
    const episodeId = await episode("b29-ba");
    const hidden = await comment(episodeId, memberId, "an di");
    const removed = await comment(episodeId, memberId, "xoa di");
    const warned = await comment(episodeId, memberId, "canh di");
    const hideId = await file(adminId, hidden);
    const deleteId = await file(adminId, removed);
    const warnId = await file(adminId, warned);

    const server = app.getHttpServer();
    expect(
      (
        await request(server)
          .patch(`/api/admin/reports/${hideId}`)
          .set("Cookie", admin)
          .send({ decision: "HIDE" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(server)
          .patch(`/api/admin/reports/${deleteId}`)
          .set("Cookie", admin)
          .send({ decision: "DELETE" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(server)
          .patch(`/api/admin/reports/${warnId}`)
          .set("Cookie", admin)
          .send({ decision: "WARN" })
      ).status,
    ).toBe(200);

    const visible = await request(server)
      .get(`/api/episodes/${episodeId}/danmaku`)
      .set("Cookie", member);
    expect(visible.status).toBe(200);
    expect(visible.body).toEqual([expect.objectContaining({ id: warned, content: "canh di" })]);

    const prisma = app.get(PrismaService);
    const stored = await prisma.report.findMany({
      where: { id: { in: [hideId, deleteId, warnId] } },
      orderBy: { id: "asc" },
    });
    expect(stored.map((item) => item.status)).toEqual(["RESOLVED", "RESOLVED", "RESOLVED"]);
    expect(stored.map((item) => item.action)).toEqual(["HIDE", "DELETE", "WARN"]);
    const flagged = await prisma.danmaku.findUniqueOrThrow({ where: { id: hidden } });
    const gone = await prisma.danmaku.findUniqueOrThrow({ where: { id: removed } });
    expect(flagged.isHidden).toBe(true);
    expect(gone.deletedAt).not.toBeNull();
  });

  it("closes every pending report of one danmaku together", async () => {
    const episodeId = await episode("b29-chung");
    const danmakuId = await comment(episodeId, memberId, "nhieu nguoi");
    const reporters = await Promise.all([
      account("Báo một", false),
      account("Báo hai", false),
      account("Báo ba", false),
    ]);
    const ids = [];
    for (const reporter of reporters) ids.push(await file(reporter.id, danmakuId));

    const decided = await request(app.getHttpServer())
      .patch(`/api/admin/reports/${ids[0]}`)
      .set("Cookie", admin)
      .send({ decision: "HIDE" });
    expect(decided.status).toBe(200);
    expect(decided.body.updated).toBe(3);

    const left = await app.get(PrismaService).report.count({
      where: { danmakuId, status: "PENDING" },
    });
    expect(left).toBe(0);
    const closed = await app.get(PrismaService).report.count({
      where: { danmakuId, status: "RESOLVED", action: "HIDE" },
    });
    expect(closed).toBe(3);
  });

  it("TEST_UC17_02 blocks a new banned word without restarting", async () => {
    const episodeId = await episode("b29-tu");
    const word = `b29cam${memberId}`;
    const created = await request(app.getHttpServer())
      .post("/api/admin/banned-words")
      .set("Cookie", admin)
      .send({ word: ` ${word.toUpperCase()} ` });
    expect(created.status).toBe(201);
    expect(created.body.word).toBe(word);

    const blocked = await app.get(DanmakuService).send({
      userId: memberId,
      episodeId,
      joinedEpisodeId: episodeId,
      durationSec: 120,
      content: `co ${word} nhe`,
      timeMs: 1000,
      now: Date.now(),
    });
    expect(blocked).toMatchObject({ kind: "rejected", reason: "BANNED_WORD" });

    const duplicate = await request(app.getHttpServer())
      .post("/api/admin/banned-words")
      .set("Cookie", admin)
      .send({ word });
    expect(duplicate.status).toBe(409);

    const removed = await request(app.getHttpServer())
      .delete(`/api/admin/banned-words/${created.body.id}`)
      .set("Cookie", admin);
    expect(removed.status).toBe(204);

    const allowed = await app.get(DanmakuService).send({
      userId: memberId,
      episodeId,
      joinedEpisodeId: episodeId,
      durationSec: 120,
      content: `co ${word} nhe`,
      timeMs: 2000,
      now: Date.now() + 10_000,
    });
    expect(allowed.kind).toBe("saved");

    const guest = await request(app.getHttpServer())
      .post("/api/admin/banned-words")
      .send({ word: "khach" });
    expect(guest.status).toBe(401);
  });

  async function account(
    displayName: string,
    makeAdmin: boolean,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b29-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName,
      birthYear: 1997,
    });
    expect(registered.status).toBe(201);
    if (makeAdmin) {
      await app.get(PrismaService).user.update({ where: { email }, data: { role: "ADMIN" } });
    }
    return { cookie: sessionCookie(registered), id: registered.body.id as number };
  }

  async function episode(slug: string): Promise<number> {
    const movie = await app.get(PrismaService).movie.create({
      data: {
        slug,
        title: `Phim ${slug}`,
        description: "Mô tả kiểm duyệt",
        type: "MOVIE",
        releaseYear: 2024,
        ageRating: "P",
        status: "PUBLISHED",
        publishedAt: new Date(),
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
      },
    });
    const created = await app.get(PrismaService).episode.create({
      data: { movieId: movie.id, number: 1, durationSec: 120 },
    });
    return created.id;
  }

  async function comment(episodeId: number, userId: number, content: string): Promise<number> {
    const created = await app.get(PrismaService).danmaku.create({
      data: { episodeId, userId, content, timeMs: 1000 },
    });
    return created.id;
  }

  async function file(reporterId: number, danmakuId: number): Promise<number> {
    const created = await app.get(PrismaService).report.create({
      data: { reporterUserId: reporterId, danmakuId, reason: "Không phù hợp" },
    });
    return created.id;
  }
});
