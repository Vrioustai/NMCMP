import { type INestApplication } from "@nestjs/common";
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

describe("Admin genres", () => {
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
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "b15-" } } });
    await prisma.genre.deleteMany({ where: { name: { in: ["Hài", "hài", "Hài kịch"] } } });
  });

  afterAll(async () => {
    await app.close();
  });

  it("TEST_UC15_01 rejects a genre name that already exists", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/admin/genres")
      .set("Cookie", admin)
      .send({ name: "  Hài  " });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: created.body.id, name: "Hài", movieCount: 0 });

    const again = await request(app.getHttpServer())
      .post("/api/admin/genres")
      .set("Cookie", admin)
      .send({ name: "Hài" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("GENRE_TAKEN");
  });

  it("rejects a name that differs only by letter case", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/genres")
      .set("Cookie", admin)
      .send({ name: "Hài" })
      .expect(201);

    const lower = await request(app.getHttpServer())
      .post("/api/admin/genres")
      .set("Cookie", admin)
      .send({ name: "hài" });
    expect(lower.status).toBe(409);
    expect(lower.body.error.code).toBe("GENRE_TAKEN");
  });

  it("refuses to delete a genre that is attached to a movie", async () => {
    const genre = await request(app.getHttpServer())
      .post("/api/admin/genres")
      .set("Cookie", admin)
      .send({ name: "Hài" });
    expect(genre.status).toBe(201);

    const movie = await request(app.getHttpServer())
      .post("/api/admin/movies")
      .set("Cookie", admin)
      .send({
        title: "Phim thể loại",
        slug: `b15-${Date.now()}`,
        description: "Mô tả thể loại",
        type: "MOVIE",
        releaseYear: 2024,
        ageRating: "P",
        genreIds: [genre.body.id],
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
      });
    expect(movie.status).toBe(201);

    const blocked = await request(app.getHttpServer())
      .delete(`/api/admin/genres/${genre.body.id}`)
      .set("Cookie", admin);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("GENRE_IN_USE");

    const listed = await request(app.getHttpServer()).get("/api/admin/genres").set("Cookie", admin);
    expect(listed.status).toBe(200);
    expect(listed.body).toContainEqual({ id: genre.body.id, name: "Hài", movieCount: 1 });

    await request(app.getHttpServer())
      .delete(`/api/admin/movies/${movie.body.id}`)
      .set("Cookie", admin)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/admin/genres/${genre.body.id}`)
      .set("Cookie", admin)
      .expect(204);
  });

  it("rejects genre routes for a guest and a normal user", async () => {
    const user = await account(false);
    const server = app.getHttpServer();
    const guest = [
      request(server).get("/api/admin/genres"),
      request(server).post("/api/admin/genres").send({ name: "Hài" }),
      request(server).patch("/api/admin/genres/1").send({ name: "Hài" }),
      request(server).delete("/api/admin/genres/1"),
    ];
    for (const call of guest) expect((await call).status).toBe(401);

    const forbidden = await request(server).get("/api/admin/genres").set("Cookie", user);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  async function account(makeAdmin: boolean): Promise<string> {
    const email = `b15-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
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
});
