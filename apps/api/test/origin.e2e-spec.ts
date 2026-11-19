import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { MediaStorage } from "../src/media/media-storage";

describe("API core", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app
      .get(MediaStorage)
      .remove("posters/b06-probe.txt")
      .catch(() => undefined);
    await app
      .get(MediaStorage)
      .remove("subtitles/probe.vtt")
      .catch(() => undefined);
    await app.close();
  });

  it("rejects a write from another origin and lets a write without Origin through", async () => {
    const foreign = await request(app.getHttpServer())
      .post("/api/movies")
      .set("Origin", "http://evil.example");
    expect(foreign.status).toBe(403);
    expect(foreign.body).toMatchObject({ error: { code: "FORBIDDEN" } });

    const same = await request(app.getHttpServer())
      .post("/api/movies")
      .set("Origin", "http://localhost:3000");
    expect(same.status).toBe(404);
    expect(same.body).toMatchObject({ error: { code: "NOT_FOUND" } });

    const server = await request(app.getHttpServer()).post("/api/movies");
    expect(server.status).toBe(404);
    expect(server.body).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("does not apply the origin check to reads", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/movies")
      .set("Origin", "http://evil.example");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  it("reports PostgreSQL and Redis on /api/health", async () => {
    let response = await request(app.getHttpServer()).get("/api/health");
    for (let attempt = 0; attempt < 20 && response.body.redis !== "up"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      response = await request(app.getHttpServer()).get("/api/health");
    }
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", postgres: "up", redis: "up" });
  });

  it("serves a file from /media outside the /api prefix", async () => {
    const storage = app.get(MediaStorage);
    await storage.save("posters/b06-probe.txt", Buffer.from("xin-chao"));
    await storage.save("subtitles/probe.vtt", Buffer.from("WEBVTT\n"));

    const poster = await request(app.getHttpServer()).get("/media/posters/b06-probe.txt");
    expect(poster.status).toBe(200);
    expect(poster.text).toBe("xin-chao");

    const subtitle = await request(app.getHttpServer()).get("/media/subtitles/probe.vtt");
    expect(subtitle.status).toBe(200);
    expect(subtitle.headers["content-type"]).toContain("text/vtt");

    const missing = await request(app.getHttpServer()).get("/media/posters/missing.txt");
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
