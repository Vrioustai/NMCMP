import { Prisma } from "@prisma/client";
import type { BannedWordsService } from "../danmaku/banned-words.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminWordsService } from "./admin-words.service";

describe("AdminWordsService", () => {
  const createdAt = new Date("2026-11-19T02:00:00.000Z");

  function harness() {
    const bannedWord = {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    };
    const refresh = jest.fn().mockResolvedValue(undefined);
    const words = new AdminWordsService(
      { bannedWord } as unknown as PrismaService,
      { refresh } as unknown as BannedWordsService,
    );
    return { bannedWord, refresh, words };
  }

  it("stores a normalized word and refreshes the gateway cache", async () => {
    const { bannedWord, refresh, words } = harness();
    bannedWord.create.mockResolvedValue({
      id: 5,
      word: "ngu",
      createdAt,
      creator: { displayName: "Quản trị" },
    });

    await expect(words.create(1, " Ngu ")).resolves.toEqual({
      id: 5,
      word: "ngu",
      createdAt: createdAt.toISOString(),
      creator: { displayName: "Quản trị" },
    });
    expect(bannedWord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { word: "ngu", creatorUserId: 1 } }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);

    bannedWord.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("trùng", { code: "P2002", clientVersion: "6" }),
    );
    await expect(words.create(1, "ngu")).rejects.toMatchObject({ code: "WORD_TAKEN" });
    expect(refresh).toHaveBeenCalledTimes(1);

    await expect(words.create(1, "   ")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    bannedWord.create.mockRejectedValueOnce(new Error("db"));
    await expect(words.create(1, "khac")).rejects.toThrow("db");
  });

  it("lists words newest first", async () => {
    const { bannedWord, words } = harness();
    bannedWord.findMany.mockResolvedValue([
      { id: 5, word: "ngu", createdAt, creator: { displayName: "Quản trị" } },
    ]);
    await expect(words.list()).resolves.toEqual([
      {
        id: 5,
        word: "ngu",
        createdAt: createdAt.toISOString(),
        creator: { displayName: "Quản trị" },
      },
    ]);
  });

  it("removes a word and refreshes the cache", async () => {
    const { bannedWord, refresh, words } = harness();
    bannedWord.findUnique.mockResolvedValueOnce(null);
    await expect(words.remove(9)).rejects.toMatchObject({ code: "NOT_FOUND" });

    bannedWord.findUnique.mockResolvedValueOnce({ id: 5 });
    await words.remove(5);
    expect(bannedWord.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
