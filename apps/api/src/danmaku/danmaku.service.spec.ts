import { Logger } from "@nestjs/common";
import type { UserProfile } from "@movie/contracts";
import type { PrismaService } from "../prisma/prisma.service";
import type { AccountStatusService } from "./account-status.service";
import type { BannedWordsService } from "./banned-words.service";
import { DanmakuService, type SendInput } from "./danmaku.service";
import type { RateLimitService } from "./rate-limit.service";

const viewer: UserProfile = {
  id: 4,
  email: "a@filmgenz.test",
  displayName: "A",
  avatarUrl: null,
  birthYear: 2000,
  role: "USER",
};

function service(options?: {
  active?: boolean;
  words?: string[];
  rate?: { ok: true } | { ok: false; retryAfterMs: number };
  episode?: Record<string, unknown> | null;
}) {
  const create = jest.fn().mockResolvedValue({
    id: 9,
    content: "xin chào",
    timeMs: 310000,
    createdAt: new Date("2026-06-15T04:00:00.000Z"),
  });
  const findMany = jest.fn().mockResolvedValue([{ id: 9, content: "xin chào", timeMs: 1000 }]);
  const findUnique = jest
    .fn()
    .mockResolvedValue(
      options?.episode === undefined
        ? {
            id: 3,
            durationSec: 1200,
            movie: { status: "PUBLISHED", ageRating: "T16" },
            subtitles: [],
          }
        : options.episode,
    );
  const danmaku = new DanmakuService(
    { danmaku: { create, findMany }, episode: { findUnique } } as unknown as PrismaService,
    {
      isActive: jest.fn().mockResolvedValue(options?.active ?? true),
    } as unknown as AccountStatusService,
    { current: jest.fn().mockResolvedValue(options?.words ?? []) } as unknown as BannedWordsService,
    {
      take: jest.fn().mockResolvedValue(options?.rate ?? { ok: true }),
    } as unknown as RateLimitService,
  );
  return { danmaku, create, findMany };
}

function input(extra: Partial<SendInput> = {}): SendInput {
  return {
    userId: 4,
    episodeId: 3,
    joinedEpisodeId: 3,
    durationSec: 1200,
    content: "xin chào",
    timeMs: 310000,
    now: 1_000,
    ...extra,
  };
}

describe("DanmakuService", () => {
  let log: jest.Spied<Logger["log"]>;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => log.mockRestore());

  it("rejects a locked account before it stores or limits anything", async () => {
    const { danmaku, create } = service({ active: false });
    await expect(danmaku.send(input({ content: "bí mật" }))).resolves.toMatchObject({
      kind: "locked",
    });
    expect(create).not.toHaveBeenCalled();
    expect(logged()).toContain("LOCKED");
    expect(logged()).not.toContain("bí mật");
  });

  it("drops a bad payload without counting it toward the rate limit", async () => {
    const { danmaku, create } = service();
    await expect(danmaku.send(input({ joinedEpisodeId: 8 }))).resolves.toMatchObject({
      kind: "invalid",
    });
    await expect(danmaku.send(input({ timeMs: 1_200_001 }))).resolves.toMatchObject({
      kind: "invalid",
    });
    await expect(danmaku.send(input({ content: "  \u0000  " }))).resolves.toMatchObject({
      kind: "invalid",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a long comment, a banned word and a second send inside the window", async () => {
    const long = service();
    await expect(long.danmaku.send(input({ content: "a".repeat(101) }))).resolves.toMatchObject({
      kind: "rejected",
      reason: "TOO_LONG",
    });

    const banned = service({ words: ["ngu"] });
    await expect(banned.danmaku.send(input({ content: "nguyên" }))).resolves.toMatchObject({
      kind: "saved",
    });
    await expect(banned.danmaku.send(input({ content: "đồ ngu" }))).resolves.toMatchObject({
      kind: "rejected",
      reason: "BANNED_WORD",
    });

    const limited = service({ rate: { ok: false, retryAfterMs: 900 } });
    await expect(limited.danmaku.send(input())).resolves.toMatchObject({
      kind: "rejected",
      reason: "RATE_LIMIT",
      retryAfterMs: 900,
    });
    expect(logged()).not.toContain("xin chào");
  });

  it("stores a comment and lists at most 5000 visible lines", async () => {
    const { danmaku, create, findMany } = service({ episode: null });
    const saved = await danmaku.send(input({ durationSec: null, timeMs: 9_000_000 }));
    expect(saved.kind).toBe("saved");
    if (saved.kind === "saved") expect(saved.message.createdAt).toBe("2026-06-15T04:00:00.000Z");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: "xin chào" }) }),
    );

    const open = service();
    await expect(
      open.danmaku.list(3, viewer, new Date("2026-06-15T03:00:00.000Z")),
    ).resolves.toEqual([{ id: 9, content: "xin chào", timeMs: 1000 }]);
    expect(open.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { episodeId: 3, isHidden: false, deletedAt: null },
        take: 5000,
      }),
    );
    await expect(
      danmaku.list(3, { ...viewer, birthYear: 2009 }, new Date("2026-06-15T03:00:00.000Z")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(findMany).not.toHaveBeenCalled();
  });
});

function logged(): string {
  return (Logger.prototype.log as unknown as jest.Mock).mock.calls
    .map((call) => String(call[0]))
    .join("\n");
}
