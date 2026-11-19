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

describe("Ratings and comments", () => {
  let app: INestApplication;
  let first = "";
  let firstId = 0;
  let second = "";
  const year = Clock.start().year();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const created = await account(year - 25, "Người chấm");
    first = created.cookie;
    firstId = created.id;
    second = (await account(year - 25, "Người thứ hai")).cookie;
  });

  afterAll(async () => {
    await app.get(PrismaService).movie.deleteMany({ where: { slug: { startsWith: "b26-" } } });
    await app.close();
  });

  it("TEST_UC11_01 keeps one score row and updates the average", async () => {
    const movieId = await movie("b26-sao", "PUBLISHED");
    const four = await request(app.getHttpServer())
      .put(`/api/movies/${movieId}/rating`)
      .set("Cookie", first)
      .send({ score: 4 });
    expect(four.status).toBe(200);
    expect(four.body).toEqual({ ratingAverage: 4, ratingCount: 1 });

    const two = await request(app.getHttpServer())
      .put(`/api/movies/${movieId}/rating`)
      .set("Cookie", first)
      .send({ score: 2 });
    expect(two.body).toEqual({ ratingAverage: 2, ratingCount: 1 });
    const mine = await app.get(PrismaService).rating.count({ where: { userId: firstId, movieId } });
    expect(mine).toBe(1);

    const other = await request(app.getHttpServer())
      .put(`/api/movies/${movieId}/rating`)
      .set("Cookie", second)
      .send({ score: 5 });
    expect(other.body).toEqual({ ratingAverage: 3.5, ratingCount: 2 });

    const state = await request(app.getHttpServer())
      .get(`/api/me/movies/${movieId}/state`)
      .set("Cookie", first);
    expect(state.status).toBe(200);
    expect(state.body).toEqual({ myScore: 2, isFavorite: false });
  });

  it("TEST_UC11_02 shows a comment and the author's name to a guest", async () => {
    const movieId = await movie("b26-loi", "PUBLISHED");
    const created = await request(app.getHttpServer())
      .post(`/api/movies/${movieId}/comments`)
      .set("Cookie", first)
      .send({ content: "Phim rất hay" });
    expect(created.status).toBe(201);
    expect(created.body.user.displayName).toBe("Người chấm");

    const listed = await request(app.getHttpServer()).get(`/api/movies/${movieId}/comments`);
    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({
        content: "Phim rất hay",
        user: expect.objectContaining({ displayName: "Người chấm" }),
      }),
    ]);
  });

  it("hides a draft and rejects a guest or a bad score", async () => {
    const draftId = await movie("b26-nhap", "DRAFT");
    const hidden = await request(app.getHttpServer())
      .put(`/api/movies/${draftId}/rating`)
      .set("Cookie", first)
      .send({ score: 5 });
    expect(hidden.status).toBe(404);
    const comments = await request(app.getHttpServer()).get(`/api/movies/${draftId}/comments`);
    expect(comments.status).toBe(404);
    const posted = await request(app.getHttpServer())
      .post(`/api/movies/${draftId}/comments`)
      .set("Cookie", first)
      .send({ content: "nháp" });
    expect(posted.status).toBe(404);

    const publishedId = await movie("b26-khach", "PUBLISHED");
    const guest = await request(app.getHttpServer())
      .post(`/api/movies/${publishedId}/comments`)
      .send({ content: "khách" });
    expect(guest.status).toBe(401);
    const bad = await request(app.getHttpServer())
      .put(`/api/movies/${publishedId}/rating`)
      .set("Cookie", first)
      .send({ score: 6 });
    expect(bad.status).toBe(400);
    const blank = await request(app.getHttpServer())
      .post(`/api/movies/${publishedId}/comments`)
      .set("Cookie", first)
      .send({ content: "   " });
    expect(blank.status).toBe(400);
  });

  async function account(
    birthYear: number,
    displayName: string,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b26-${displayName.length}-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
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
        description: "Mô tả đánh giá",
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
