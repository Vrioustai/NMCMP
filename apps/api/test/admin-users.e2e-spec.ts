import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Admin users", () => {
  let app: INestApplication;
  let admin = "";
  let adminId = 0;
  let member = "";
  let memberId = 0;
  let memberEmail = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const editor = await account("Quản trị B28", true);
    admin = editor.cookie;
    adminId = editor.id;
    const viewer = await account("Người xem B28", false);
    member = viewer.cookie;
    memberId = viewer.id;
    memberEmail = viewer.email;
    await warnings(memberId, adminId);
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "b28-" } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "b28-" } } });
    await app.close();
  });

  it("TEST_UC16_01 locks a member, blocks the next request, then unlocks", async () => {
    const listed = await request(app.getHttpServer())
      .get("/api/admin/users")
      .query({ q: "Người xem B28" })
      .set("Cookie", admin);
    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({
        id: memberId,
        warningCount: 1,
        status: "ACTIVE",
        lastActiveAt: expect.any(String),
      }),
    ]);

    const locked = await request(app.getHttpServer())
      .patch(`/api/admin/users/${memberId}/status`)
      .set("Cookie", admin)
      .send({ status: "LOCKED" });
    expect(locked.status).toBe(200);

    const stillIn = await request(app.getHttpServer()).get("/api/me").set("Cookie", member);
    expect(stillIn.status).toBe(403);
    expect(stillIn.body.error.code).toBe("ACCOUNT_LOCKED");

    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: memberEmail, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe("ACCOUNT_LOCKED");

    const opened = await request(app.getHttpServer())
      .patch(`/api/admin/users/${memberId}/status`)
      .set("Cookie", admin)
      .send({ status: "ACTIVE" });
    expect(opened.status).toBe(200);

    const again = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: memberEmail, password: PASSWORD });
    expect(again.status).toBe(200);
  });

  it("refuses to lock an admin or the current admin", async () => {
    const other = await account("Quản trị khác", true);
    const server = app.getHttpServer();
    const adminLock = await request(server)
      .patch(`/api/admin/users/${other.id}/status`)
      .set("Cookie", admin)
      .send({ status: "LOCKED" });
    expect(adminLock.status).toBe(422);
    expect(adminLock.body.error.code).toBe("CANNOT_LOCK_ADMIN");

    const self = await request(server)
      .patch(`/api/admin/users/${adminId}/status`)
      .set("Cookie", admin)
      .send({ status: "LOCKED" });
    expect(self.status).toBe(422);
    expect(self.body.error.code).toBe("CANNOT_LOCK_ADMIN");
  });

  it("rejects a guest and a normal member", async () => {
    const server = app.getHttpServer();
    const guest = await request(server).get("/api/admin/users");
    expect(guest.status).toBe(401);
    const forbidden = await request(server).get("/api/admin/users").set("Cookie", member);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  async function account(
    displayName: string,
    makeAdmin: boolean,
  ): Promise<{ cookie: string; id: number; email: string }> {
    const email = `b28-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
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
    return { cookie: sessionCookie(registered), id: registered.body.id as number, email };
  }

  async function warnings(userId: number, resolverId: number): Promise<void> {
    const prisma = app.get(PrismaService);
    const movie = await prisma.movie.create({
      data: {
        slug: `b28-${userId}`,
        title: "Phim cảnh cáo",
        description: "Mô tả",
        type: "MOVIE",
        releaseYear: 2024,
        ageRating: "P",
        status: "DRAFT",
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
      },
    });
    const episode = await prisma.episode.create({ data: { movieId: movie.id, number: 1 } });
    const warned = await prisma.danmaku.create({
      data: { episodeId: episode.id, userId, content: "một", timeMs: 0 },
    });
    const hidden = await prisma.danmaku.create({
      data: { episodeId: episode.id, userId, content: "hai", timeMs: 1 },
    });
    await prisma.report.create({
      data: {
        reporterUserId: resolverId,
        danmakuId: warned.id,
        reason: "Không phù hợp",
        status: "RESOLVED",
        action: "WARN",
        resolverUserId: resolverId,
        resolvedAt: new Date(),
      },
    });
    await prisma.report.create({
      data: {
        reporterUserId: resolverId,
        danmakuId: hidden.id,
        reason: "Ẩn",
        status: "RESOLVED",
        action: "HIDE",
        resolverUserId: resolverId,
        resolvedAt: new Date(),
      },
    });
    await prisma.watchHistory.create({
      data: { userId, episodeId: episode.id, progressSec: 12 },
    });
  }
});
