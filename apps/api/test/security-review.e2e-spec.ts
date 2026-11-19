import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import type { ApiEnv } from "../src/config/env.schema";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: RouteLayer[] };
  path?: string;
};

describe("Security review", () => {
  let app: INestApplication;
  let port = 0;
  let webOrigin = "";
  let member = "";
  let authorId = 0;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    const address = app.getHttpServer().address();
    port = typeof address === "object" && address ? address.port : 0;
    webOrigin = app.get(ConfigService<ApiEnv, true>).getOrThrow("WEB_ORIGIN");
    member = (await account(1990, "Thanh vien B32")).cookie;
    authorId = (await account(1990, "Tac gia B32")).id;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.close();
    const prisma = app.get(PrismaService);
    await prisma.movie.deleteMany({ where: { slug: { startsWith: "b32-" } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "b32-" } } });
    await app.close();
  });

  it("TEST_NFR08 rejects a member on every admin route", async () => {
    const routes = adminRoutes(app);
    expect(routes.length).toBeGreaterThan(10);
    expect(routes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/admin/users"),
        expect.stringContaining("/admin/stats"),
        expect.stringContaining("/admin/movies"),
      ]),
    );
    for (const route of routes) {
      const response = await call(app, route, member);
      expect({ method: route.method, path: route.path, status: response.status }).toEqual({
        method: route.method,
        path: route.path,
        status: 403,
      });
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("returns not found when a member uses a draft id", async () => {
    const prisma = app.get(PrismaService);
    const movie = await prisma.movie.create({
      data: {
        slug: "b32-nhap",
        title: "Phim nháp B32",
        description: "Mô tả nháp",
        type: "MOVIE",
        releaseYear: 2024,
        ageRating: "P",
        status: "DRAFT",
        sourceUrl: "https://example.com/phim",
        license: "Dùng cho bài test",
        episodes: {
          create: { seasonNumber: 1, number: 1, durationSec: 90, streamUid: "b32-nhap" },
        },
      },
      include: { episodes: true },
    });
    const episodeId = movie.episodes[0]?.id ?? 0;
    const danmaku = await prisma.danmaku.create({
      data: { episodeId, userId: authorId, content: "nhap", timeMs: 0 },
    });
    const http = request(app.getHttpServer());

    const playback = await http.get(`/api/episodes/${episodeId}/playback`).set("Cookie", member);
    const listed = await http.get(`/api/episodes/${episodeId}/danmaku`).set("Cookie", member);
    const rating = await http
      .put(`/api/movies/${movie.id}/rating`)
      .set("Cookie", member)
      .send({ score: 5 });
    const comments = await http.get(`/api/movies/${movie.id}/comments`);
    const comment = await http
      .post(`/api/movies/${movie.id}/comments`)
      .set("Cookie", member)
      .send({ content: "binh luan" });
    const state = await http.get(`/api/me/movies/${movie.id}/state`).set("Cookie", member);
    const saved = await http.put(`/api/me/favorites/${movie.id}`).set("Cookie", member);
    const removed = await http.delete(`/api/me/favorites/${movie.id}`).set("Cookie", member);
    const history = await http
      .put(`/api/me/history/${episodeId}`)
      .set("Cookie", member)
      .send({ progressSec: 1 });
    const report = await http
      .post("/api/reports")
      .set("Cookie", member)
      .send({ danmakuId: danmaku.id, reason: "noi dung" });
    const detail = await http.get("/api/movies/b32-nhap");
    const socket = await openSocket(port, webOrigin, member);
    sockets.push(socket);
    const joined = await emit(socket, "danmaku:join", { episodeId });

    for (const response of [
      playback,
      listed,
      rating,
      comments,
      comment,
      state,
      saved,
      removed,
      history,
      report,
      detail,
    ]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
    expect(joined).toEqual({ ok: false });
  });

  async function account(
    birthYear: number,
    displayName: string,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b32-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName,
      birthYear,
    });
    expect(registered.status).toBe(201);
    return { cookie: sessionCookie(registered), id: registered.body.id as number };
  }
});

function adminRoutes(app: INestApplication): { method: string; path: string }[] {
  const server = app.getHttpAdapter().getInstance() as { router?: { stack: RouteLayer[] } };
  const found: { method: string; path: string }[] = [];
  collect(server.router?.stack ?? [], "", found);
  return found.filter((route) => route.path.startsWith("/api/admin") && route.method !== "HEAD");
}

function collect(
  stack: RouteLayer[],
  prefix: string,
  found: { method: string; path: string }[],
): void {
  for (const layer of stack) {
    if (layer.route) {
      const full = joinRoute(prefix, layer.route.path);
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled) found.push({ method: method.toUpperCase(), path: full });
      }
      continue;
    }
    if (layer.handle?.stack)
      collect(layer.handle.stack, joinRoute(prefix, layer.path ?? ""), found);
  }
}

function joinRoute(prefix: string, routePath: string): string {
  if (!routePath) return prefix || "/";
  if (!prefix || routePath.startsWith("/")) return routePath;
  return `${prefix.replace(/\/$/, "")}/${routePath}`;
}

function call(
  app: INestApplication,
  route: { method: string; path: string },
  cookie: string,
): request.Test {
  const url = route.path.replace(/:([^/]+)/g, "1");
  const method = route.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  const pending = request(app.getHttpServer())[method](url).set("Cookie", cookie);
  if (method !== "get" && method !== "delete") pending.send({});
  return pending;
}

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

function openSocket(port: number, origin: string, cookie: string): Promise<Socket> {
  const socket = io(`http://127.0.0.1:${port}/danmaku`, {
    transports: ["websocket"],
    extraHeaders: { origin, cookie },
    reconnection: false,
    forceNew: true,
    timeout: 5000,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("hết giờ kết nối")), 5000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function emit(socket: Socket, event: string, payload: unknown): Promise<{ ok?: boolean }> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (body: { ok?: boolean }) => resolve(body));
  });
}
