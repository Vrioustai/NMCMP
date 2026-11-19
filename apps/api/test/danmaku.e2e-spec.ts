import { Logger, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { Clock } from "../src/common/clock";
import type { ApiEnv } from "../src/config/env.schema";
import { AccountStatusService } from "../src/danmaku/account-status.service";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisService } from "../src/redis/redis.service";

const PASSWORD = "MatKhau1";
const FIVE_TEN = 5 * 60 * 1000 + 10 * 1000;

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  const lines = header ? (Array.isArray(header) ? header : [header]) : [];
  return lines.find((line) => line.startsWith("fgz_session="))?.split(";")[0] ?? "";
}

describe("Danmaku", () => {
  let app: INestApplication;
  let port = 0;
  let webOrigin = "";
  let adult = "";
  let adultId = 0;
  let young = "";
  const year = Clock.start().year();
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    const address = app.getHttpServer().address();
    port = typeof address === "object" && address ? address.port : 0;
    webOrigin = app.get(ConfigService<ApiEnv, true>).getOrThrow("WEB_ORIGIN");
    const grown = await account(year - 18, "Mười tám");
    adult = grown.cookie;
    adultId = grown.id;
    const child = await account(year - 17, "Mười bảy");
    young = child.cookie;
    await app.get(PrismaService).bannedWord.create({
      data: { word: "ngu", creatorUserId: adultId },
    });
  });

  afterEach(() => {
    for (const socket of sockets) socket.close();
    sockets.length = 0;
  });

  afterAll(async () => {
    await app.get(PrismaService).movie.deleteMany({ where: { slug: { startsWith: "b23-" } } });
    await app.close();
  });

  it("rejects a foreign origin and a missing session", async () => {
    await expect(open(null, "https://evil.example")).rejects.toThrow(/websocket error|Origin/);
    await expect(open(null)).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it("TEST_UC08_01 delivers one comment to both viewers at 05:10", async () => {
    const episodeId = await episodeOf("b23-cung-xem", "T16", 1200);
    const sender = await open(adult);
    const viewer = await open(adult);
    expect(await join(sender, episodeId)).toEqual({ ok: true });
    expect(await join(viewer, episodeId)).toEqual({ ok: true });
    const seenByViewer = once(viewer, "danmaku:new");
    const seenBySender = once(sender, "danmaku:new");
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    let ack: { ok: boolean; id?: number };
    try {
      ack = await emit(sender, "danmaku:send", {
        episodeId,
        content: "xin chào bí mật",
        timeMs: FIVE_TEN,
      });
    } finally {
      const lines = log.mock.calls.map((call) => String(call[0])).join("\n");
      log.mockRestore();
      expect(lines).toContain("danmaku.send");
      expect(lines).not.toContain("bí mật");
    }
    expect(ack).toMatchObject({ ok: true });
    const message = await seenByViewer;
    expect(message).toMatchObject({ content: "xin chào bí mật", timeMs: FIVE_TEN });
    expect(await seenBySender).toMatchObject({ id: ack.id });
    expect(message).not.toHaveProperty("userId");

    const listed = await request(app.getHttpServer())
      .get(`/api/episodes/${episodeId}/danmaku`)
      .set("Cookie", adult);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ id: ack.id, content: "xin chào bí mật", timeMs: FIVE_TEN }),
    ]);
  });

  it("TEST_UC08_02, UC08_03 and UC08_04 reject length, a banned word and a fast second send", async () => {
    const episodeId = await episodeOf("b23-tu-choi", "P", 600);
    const socket = await open(await freshCookie());
    expect(await join(socket, episodeId)).toEqual({ ok: true });

    const tooLong = await emit(socket, "danmaku:send", {
      episodeId,
      content: "a".repeat(101),
      timeMs: 0,
    });
    expect(tooLong).toEqual({ ok: false, reason: "TOO_LONG" });

    const allowed = await emit(socket, "danmaku:send", {
      episodeId,
      content: "nguyên",
      timeMs: 0,
    });
    expect(allowed.ok).toBe(true);

    const banned = await emit(socket, "danmaku:send", {
      episodeId,
      content: "đồ NGU",
      timeMs: 0,
    });
    expect(banned).toEqual({ ok: false, reason: "BANNED_WORD" });

    const rejected = once(socket, "danmaku:rejected");
    const again = await emit(socket, "danmaku:send", {
      episodeId,
      content: "lần hai",
      timeMs: 1,
    });
    expect(again).toEqual({ ok: false, reason: "RATE_LIMIT" });
    const notice = await rejected;
    expect(notice).toMatchObject({ reason: "RATE_LIMIT" });
    if (typeof notice["retryAfterMs"] !== "number") throw new Error("thiếu thời gian chờ");
    expect(notice["retryAfterMs"]).toBeGreaterThan(0);
  });

  it("keeps the limit when Redis is off and blocks a locked account on the old connection", async () => {
    const episodeId = await episodeOf("b23-redis", "P", 600);
    const redis = app.get(RedisService);
    redis.isAvailable = false;
    try {
      const socket = await open(await freshCookie());
      expect(await join(socket, episodeId)).toEqual({ ok: true });
      expect(
        (await emit(socket, "danmaku:send", { episodeId, content: "một", timeMs: 0 })).ok,
      ).toBe(true);
      const limited = await emit(socket, "danmaku:send", { episodeId, content: "hai", timeMs: 1 });
      expect(limited).toMatchObject({ ok: false, reason: "RATE_LIMIT" });
    } finally {
      redis.isAvailable = true;
    }

    const person = await account(year - 18, "Sắp khóa");
    const lockedEpisode = await episodeOf("b23-khoa", "P", 600);
    const socket = await open(person.cookie);
    expect(await join(socket, lockedEpisode)).toEqual({ ok: true });
    await app
      .get(PrismaService)
      .user.update({ where: { id: person.id }, data: { status: "LOCKED" } });
    expect(
      (
        await emit(socket, "danmaku:send", {
          episodeId: lockedEpisode,
          content: "còn kịp",
          timeMs: 0,
        })
      ).ok,
    ).toBe(true);
    app.get(AccountStatusService).expire(person.id);
    const gone = once(socket, "disconnect");
    const blocked = await emit(socket, "danmaku:send", {
      episodeId: lockedEpisode,
      content: "không kịp",
      timeMs: 1,
    });
    expect(blocked).toEqual({ ok: false });
    await gone;
    expect(
      await app.get(PrismaService).danmaku.count({
        where: { episodeId: lockedEpisode, content: "không kịp" },
      }),
    ).toBe(0);
  });

  it("refuses a draft, a T18 room for a 17-year-old, and hides removed comments", async () => {
    const prisma = app.get(PrismaService);
    const draft = await prisma.movie.create({
      data: movie("b23-nhap", "T18", "DRAFT", 90),
      include: { episodes: true },
    });
    const adultSocket = await open(adult);
    expect(await join(adultSocket, draft.episodes[0]?.id ?? 0)).toEqual({ ok: false });

    const adultOnly = await episodeOf("b23-tuoi", "T18", 600);
    const child = await open(young);
    expect(await join(child, adultOnly)).toEqual({ ok: false });
    const blocked = await request(app.getHttpServer())
      .get(`/api/episodes/${adultOnly}/danmaku`)
      .set("Cookie", young);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("AGE_RESTRICTED");

    const visible = await episodeOf("b23-loc", "P", 600);
    await prisma.danmaku.create({
      data: { episodeId: visible, userId: adultId, content: "ẩn", timeMs: 1, isHidden: true },
    });
    await prisma.danmaku.create({
      data: {
        episodeId: visible,
        userId: adultId,
        content: "xóa",
        timeMs: 2,
        deletedAt: new Date(),
      },
    });
    await prisma.danmaku.create({
      data: { episodeId: visible, userId: adultId, content: "còn", timeMs: 3 },
    });
    const listed = await request(app.getHttpServer())
      .get(`/api/episodes/${visible}/danmaku`)
      .set("Cookie", adult);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([expect.objectContaining({ content: "còn", timeMs: 3 })]);

    const guest = await request(app.getHttpServer()).get(`/api/episodes/${visible}/danmaku`);
    expect(guest.status).toBe(401);
  });

  it("leaves the previous room", async () => {
    const first = await episodeOf("b23-phong-1", "P", 600);
    const second = await episodeOf("b23-phong-2", "P", 600);
    const socket = await open(await freshCookie());
    expect(await join(socket, first)).toEqual({ ok: true });
    expect(await join(socket, second)).toEqual({ ok: true });
    const stale = await emit(socket, "danmaku:send", {
      episodeId: first,
      content: "cũ",
      timeMs: 0,
    });
    expect(stale).toEqual({ ok: false });
    const current = await emit(socket, "danmaku:send", {
      episodeId: second,
      content: "mới",
      timeMs: 0,
    });
    expect(current.ok).toBe(true);
  });

  async function open(cookie: string | null, origin = webOrigin): Promise<Socket> {
    const headers: Record<string, string> = { origin };
    if (cookie) headers.cookie = cookie;
    const socket = io(`http://127.0.0.1:${port}/danmaku`, {
      transports: ["websocket"],
      extraHeaders: headers,
      reconnection: false,
      forceNew: true,
      timeout: 5000,
    });
    sockets.push(socket);
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

  function join(socket: Socket, episodeId: number): Promise<{ ok: boolean }> {
    return emit(socket, "danmaku:join", { episodeId });
  }

  function emit(
    socket: Socket,
    event: string,
    payload: unknown,
  ): Promise<{ ok: boolean; id?: number; reason?: string; retryAfterMs?: number }> {
    return new Promise((resolve) => {
      socket.emit(
        event,
        payload,
        (body: { ok: boolean; id?: number; reason?: string; retryAfterMs?: number }) =>
          resolve(body),
      );
    });
  }

  function once(socket: Socket, event: string): Promise<Record<string, unknown>> {
    return new Promise((resolve) => socket.once(event, resolve));
  }

  async function freshCookie(): Promise<string> {
    return (await account(year - 25, "Người xem")).cookie;
  }

  async function account(
    birthYear: number,
    displayName: string,
  ): Promise<{ cookie: string; id: number }> {
    const email = `b23-${birthYear}-${Date.now()}-${Math.floor(Math.random() * 1000)}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName,
      birthYear,
    });
    expect(registered.status).toBe(201);
    return { cookie: sessionCookie(registered), id: registered.body.id as number };
  }

  async function episodeOf(
    slug: string,
    ageRating: "P" | "T16" | "T18",
    durationSec: number,
  ): Promise<number> {
    const created = await app.get(PrismaService).movie.create({
      data: movie(slug, ageRating, "PUBLISHED", durationSec),
      include: { episodes: true },
    });
    return created.episodes[0]?.id ?? 0;
  }

  function movie(
    slug: string,
    ageRating: "P" | "T16" | "T18",
    status: "DRAFT" | "PUBLISHED",
    durationSec: number,
  ) {
    return {
      slug,
      title: `Phim ${slug}`,
      description: "Mô tả danmaku",
      type: "MOVIE" as const,
      releaseYear: 2024,
      ageRating,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      sourceUrl: "https://example.com/phim",
      license: "Dùng cho bài test",
      episodes: { create: { seasonNumber: 1, number: 1, durationSec, streamUid: slug } },
    };
  }
});
