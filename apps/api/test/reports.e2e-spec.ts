import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { Clock } from "../src/common/clock";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Reports", () => {
  let app: INestApplication;
  let author = "";
  let authorId = 0;
  let viewer = "";
  const year = Clock.start().year();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const created = await account(year - 25, "Tác giả");
    author = created.cookie;
    authorId = created.id;
    viewer = (await account(year - 25, "Người xem")).cookie;
  });

  afterAll(async () => {
    await app.get(PrismaService).movie.deleteMany({ where: { slug: { startsWith: "b25-" } } });
    await app.close();
  });

  it("TEST_UC10_01 stores a pending report", async () => {
    const danmakuId = await comment("b25-cho", false);
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    let response: request.Response;
    try {
      response = await request(app.getHttpServer())
        .post("/api/reports")
        .set("Cookie", viewer)
        .send({ danmakuId, reason: "Nội dung không phù hợp" });
    } finally {
      const lines = log.mock.calls.map((call) => String(call[0])).join("\n");
      log.mockRestore();
      expect(lines).not.toContain("Nội dung không phù hợp");
    }
    expect(response.status).toBe(201);
    const row = await app.get(PrismaService).report.findUnique({ where: { id: response.body.id } });
    expect(row).toMatchObject({
      reporterUserId: expect.any(Number),
      danmakuId,
      reason: "Nội dung không phù hợp",
      status: "PENDING",
    });
    expect(row?.reporterUserId).not.toBe(authorId);
  });

  it("returns 409 the second time and 404 for a hidden comment", async () => {
    const danmakuId = await comment("b25-lan-hai", false);
    const first = await request(app.getHttpServer())
      .post("/api/reports")
      .set("Cookie", viewer)
      .send({ danmakuId, reason: "Spam hoặc quảng cáo" });
    expect(first.status).toBe(201);
    const second = await request(app.getHttpServer())
      .post("/api/reports")
      .set("Cookie", viewer)
      .send({ danmakuId, reason: "Spam hoặc quảng cáo" });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("ALREADY_REPORTED");
    const count = await app.get(PrismaService).report.count({ where: { danmakuId } });
    expect(count).toBe(1);

    const hiddenId = await comment("b25-an", true);
    const hidden = await request(app.getHttpServer())
      .post("/api/reports")
      .set("Cookie", viewer)
      .send({ danmakuId: hiddenId, reason: "đã ẩn" });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("NOT_FOUND");
  });

  it("refuses the author, a guest, and a blank reason", async () => {
    const danmakuId = await comment("b25-minh", false);
    const own = await request(app.getHttpServer())
      .post("/api/reports")
      .set("Cookie", author)
      .send({ danmakuId, reason: "của mình" });
    expect(own.status).toBe(403);
    expect(own.body.error.code).toBe("FORBIDDEN");

    const guest = await request(app.getHttpServer())
      .post("/api/reports")
      .send({ danmakuId, reason: "khách" });
    expect(guest.status).toBe(401);

    const blank = await request(app.getHttpServer())
      .post("/api/reports")
      .set("Cookie", viewer)
      .send({ danmakuId, reason: "   " });
    expect(blank.status).toBe(400);
    expect(blank.body.error.code).toBe("VALIDATION_FAILED");
  });

  async function account(
    birthYear: number,
    displayName: string,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b25-${displayName.length}-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName,
      birthYear,
    });
    expect(registered.status).toBe(201);
    return { cookie: sessionCookie(registered), id: registered.body.id as number };
  }

  async function comment(slug: string, hidden: boolean): Promise<number> {
    const movie = await app.get(PrismaService).movie.create({
      data: {
        slug,
        title: `Phim ${slug}`,
        description: "Mô tả báo cáo",
        type: "MOVIE",
        releaseYear: 2024,
        ageRating: "P",
        status: "PUBLISHED",
        publishedAt: new Date(),
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
        episodes: {
          create: {
            seasonNumber: 1,
            number: 1,
            durationSec: 600,
            streamUid: slug,
            danmakus: {
              create: { userId: authorId, content: "bình luận", timeMs: 1000, isHidden: hidden },
            },
          },
        },
      },
      include: { episodes: { include: { danmakus: true } } },
    });
    return movie.episodes[0]?.danmakus[0]?.id ?? 0;
  }
});
