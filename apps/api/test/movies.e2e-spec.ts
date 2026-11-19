import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { type INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { seedDev } from "../prisma/fixtures/dev";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { MoviesService } from "../src/movies/movies.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisService } from "../src/redis/redis.service";

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) throw new Error("Thiếu DATABASE_URL_TEST.");

describe("Discover movies", () => {
  let app: INestApplication;
  let media = "";

  beforeAll(async () => {
    media = await mkdtemp(path.join(tmpdir(), "filmgenz-discover-"));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await seedDev(prisma, media);
    } finally {
      await prisma.$disconnect();
    }
    await app.get(RedisService).del("movies:trending");
  }, 120_000);

  afterAll(async () => {
    await app.get(RedisService).del("movies:trending");
    await app.close();
    await rm(media, { recursive: true, force: true });
  });

  it("TEST_UC05_01 lists the newest published movie first", async () => {
    const response = await request(app.getHttpServer()).get("/api/movies").query({ pageSize: 10 });
    expect(response.status).toBe(200);
    expect(response.body.pageSize).toBe(10);
    expect(response.body.items[0]).toMatchObject({
      slug: "phim-moi-01",
      ageRating: "P",
      type: "MOVIE",
    });
    expect(response.body.items.map((item: { slug: string }) => item.slug)).not.toContain(
      "phim-nhap-an-01",
    );
  });

  it("TEST_UC05_02 matches nha and does not treat Nhà as the same letters", async () => {
    const plain = await request(app.getHttpServer()).get("/api/movies").query({ q: "nha" });
    expect(plain.status).toBe(200);
    const plainSlugs = slugs(plain.body.items);
    expect(plainSlugs).toContain("phim-nha-03");
    expect(plainSlugs).not.toContain("phim-nha-04");

    const accented = await request(app.getHttpServer()).get("/api/movies").query({ q: "Nhà" });
    const accentedSlugs = slugs(accented.body.items);
    expect(accentedSlugs).toContain("phim-nha-04");
    expect(accentedSlugs).not.toContain("phim-nha-03");
  });

  it("TEST_UC05_03 keeps a movie only when every filter matches", async () => {
    const genre = await namedId("/api/genres", "Hài");
    const country = await namedId("/api/countries", "Việt Nam");
    const matched = await request(app.getHttpServer())
      .get("/api/movies")
      .query({ q: "Phim mới", genre, country, releaseYear: 2020 });
    expect(matched.status).toBe(200);
    expect(slugs(matched.body.items)).toContain("phim-moi-01");
    expect(slugs(matched.body.items)).not.toContain("phim-mau-02");

    const missed = await request(app.getHttpServer())
      .get("/api/movies")
      .query({ q: "Phim mới", genre, country, releaseYear: 2024 });
    expect(missed.body.total).toBe(0);
  });

  it("TEST_UC05_04 filters Hành động, 2024 and Hàn Quốc together", async () => {
    const genre = await namedId("/api/genres", "Hành động");
    const country = await namedId("/api/countries", "Hàn Quốc");
    const response = await request(app.getHttpServer())
      .get("/api/movies")
      .query({ genre, country, releaseYear: 2024 });
    expect(response.status).toBe(200);
    expect(slugs(response.body.items)).toEqual(["phim-mau-02"]);
  });

  it("TEST_UC05_05 drops a movie from trending as soon as it returns to draft", async () => {
    const redis = app.get(RedisService);
    await redis.del("movies:trending");
    const first = await request(app.getHttpServer()).get("/api/movies/trending");
    expect(first.status).toBe(200);
    expect(first.body[0].slug).toBe("phim-xu-huong-01");
    expect(first.body.map((item: { slug: string }) => item.slug)).not.toContain("phim-xem-cu");
    const cached = await redis.get("movies:trending");
    expect(cached).toContain(String(first.body[0].id));

    const prisma = app.get(PrismaService);
    await prisma.movie.update({ where: { slug: "phim-xu-huong-01" }, data: { status: "DRAFT" } });
    try {
      const second = await request(app.getHttpServer()).get("/api/movies/trending");
      expect(second.body.map((item: { slug: string }) => item.slug)).not.toContain(
        "phim-xu-huong-01",
      );
      expect(await redis.get("movies:trending")).toBe(cached);
    } finally {
      await prisma.movie.update({
        where: { slug: "phim-xu-huong-01" },
        data: { status: "PUBLISHED" },
      });
      await redis.del("movies:trending");
    }
  });

  it("TEST_UC06_01 returns the series detail and hides a draft", async () => {
    const hidden = await request(app.getHttpServer()).get("/api/movies/phim-nhap-an-01");
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("NOT_FOUND");

    const prisma = app.get(PrismaService);
    const movie = await prisma.movie.findUniqueOrThrow({ where: { slug: "phim-bo-mau-01" } });
    const viewers = await prisma.user.findMany({
      where: { email: { in: ["u17@filmgenz.local", "u18@filmgenz.local"] } },
      orderBy: { email: "asc" },
    });
    const first = viewers[0];
    const second = viewers[1];
    if (!first || !second) throw new Error("Thiếu tài khoản mẫu");
    await prisma.rating.createMany({
      data: [
        { userId: first.id, movieId: movie.id, score: 5 },
        { userId: second.id, movieId: movie.id, score: 4 },
      ],
    });

    const response = await request(app.getHttpServer()).get("/api/movies/phim-bo-mau-01");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      slug: "phim-bo-mau-01",
      ageRating: "T16",
      type: "SERIES",
      ratingAverage: 4.5,
      ratingCount: 2,
      license: "Dữ liệu mẫu trên máy cá nhân",
    });
    expect(response.body.seasons).toEqual([
      {
        number: 1,
        episodes: [
          expect.objectContaining({ number: 1, durationSec: 1200 }),
          expect.objectContaining({ number: 2, durationSec: 1200 }),
          expect.objectContaining({ number: 3, durationSec: 1200 }),
        ],
      },
    ]);
    expect(response.body.sourceUrl).toContain("phim-bo-mau-01");
  });

  it("serves home, genres and countries without treating home as a slug", async () => {
    const home = await request(app.getHttpServer()).get("/api/movies/home");
    expect(home.status).toBe(200);
    expect(home.body.newList).toHaveLength(10);
    expect(home.body.newList[0].slug).toBe("phim-moi-01");
    expect(home.body.trendingList[0].slug).toBe("phim-xu-huong-01");
    const action = home.body.byGenre.find(
      (row: { genre: { name: string } }) => row.genre.name === "Hành động",
    );
    expect(action.items.map((item: { slug: string }) => item.slug)).toContain("phim-mau-02");

    const genres = await request(app.getHttpServer()).get("/api/genres");
    expect(genres.body.map((item: { name: string }) => item.name)).toContain("Hành động");
    const countries = await request(app.getHttpServer()).get("/api/countries");
    expect(countries.body.map((item: { name: string }) => item.name)).toContain("Hàn Quốc");
  });

  it("still ranks trending when Redis does not answer", async () => {
    const movies = new MoviesService(app.get(PrismaService), {
      get: async () => null,
      set: async () => false,
    } as unknown as RedisService);
    const ranked = await movies.trending();
    expect(ranked[0]?.slug).toBe("phim-xu-huong-01");
    expect(ranked.map((item) => item.slug)).not.toContain("phim-xem-cu");
  });

  it("stays inside the SQL budget for the list, the detail and the home page", async () => {
    const watched = new PrismaClient({
      datasourceUrl: databaseUrl,
      log: [{ emit: "event", level: "query" }],
    });
    const queries: string[] = [];
    watched.$on("query", (event) => queries.push(event.query));
    const movies = new MoviesService(
      watched as unknown as PrismaService,
      {
        get: async () => null,
        set: async () => false,
      } as unknown as RedisService,
    );
    try {
      const list = await count(queries, () => movies.list({ page: 1, pageSize: 24 }));
      const detail = await count(queries, () => movies.detail("phim-mau-02"));
      const home = await count(queries, () => movies.home());
      expect({ list, detail, home }).toEqual({ list: 2, detail: 2, home: 4 });
    } finally {
      await watched.$disconnect();
    }
  });

  it("rejects a search that is too long", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/movies")
      .query({ q: "a".repeat(101) });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  async function namedId(pathName: string, name: string): Promise<number> {
    const response = await request(app.getHttpServer()).get(pathName);
    expect(response.status).toBe(200);
    const found = (response.body as { id: number; name: string }[]).find(
      (item) => item.name === name,
    );
    if (!found) throw new Error(`Không thấy ${name}`);
    return found.id;
  }
});

function slugs(items: { slug: string }[]): string[] {
  return items.map((item) => item.slug);
}

async function count(queries: string[], run: () => Promise<unknown>): Promise<number> {
  queries.length = 0;
  await run();
  return queries.length;
}
