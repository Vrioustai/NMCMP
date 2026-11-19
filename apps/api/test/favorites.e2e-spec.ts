import type { INestApplication } from "@nestjs/common";
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

describe("Favorites", () => {
  let app: INestApplication;
  let member = "";
  let memberId = 0;
  const year = Clock.start().year();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const created = await account(year - 25, "Người thích");
    member = created.cookie;
    memberId = created.id;
  });

  afterAll(async () => {
    await app.get(PrismaService).movie.deleteMany({ where: { slug: { startsWith: "b27-" } } });
    await app.close();
  });

  it("TEST_UC12_01 adds once, ignores the second add, then removes", async () => {
    const movieId = await movie("b27-thich", "PUBLISHED");
    const first = await request(app.getHttpServer())
      .put(`/api/me/favorites/${movieId}`)
      .set("Cookie", member);
    const second = await request(app.getHttpServer())
      .put(`/api/me/favorites/${movieId}`)
      .set("Cookie", member);
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    const stored = await app
      .get(PrismaService)
      .favorite.count({ where: { userId: memberId, movieId } });
    expect(stored).toBe(1);

    const listed = await request(app.getHttpServer())
      .get("/api/me/favorites")
      .set("Cookie", member);
    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({ id: movieId, slug: "b27-thich" }),
    ]);

    const removed = await request(app.getHttpServer())
      .delete(`/api/me/favorites/${movieId}`)
      .set("Cookie", member);
    expect(removed.status).toBe(204);
    const after = await app
      .get(PrismaService)
      .favorite.count({ where: { userId: memberId, movieId } });
    expect(after).toBe(0);
    const again = await request(app.getHttpServer())
      .delete(`/api/me/favorites/${movieId}`)
      .set("Cookie", member);
    expect(again.status).toBe(204);
  });

  it("hides a draft and rejects a guest", async () => {
    const draftId = await movie("b27-nhap", "DRAFT");
    const hidden = await request(app.getHttpServer())
      .put(`/api/me/favorites/${draftId}`)
      .set("Cookie", member);
    expect(hidden.status).toBe(404);
    const guest = await request(app.getHttpServer()).put(`/api/me/favorites/${draftId}`);
    expect(guest.status).toBe(401);
  });

  async function account(
    birthYear: number,
    displayName: string,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b27-${displayName.length}-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName,
      birthYear,
    });
    expect(registered.status).toBe(201);
    return { cookie: sessionCookie(registered), id: registered.body.id as number };
  }

  async function movie(slug: string, status: "PUBLISHED" | "DRAFT"): Promise<number> {
    const created = await app.get(PrismaService).movie.create({
      data: {
        slug,
        title: `Phim ${slug}`,
        description: "Mô tả yêu thích",
        type: "MOVIE",
        releaseYear: 2024,
        ageRating: "P",
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
      },
    });
    return created.id;
  }
});
