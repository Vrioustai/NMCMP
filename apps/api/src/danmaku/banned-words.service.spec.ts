import type { PrismaService } from "../prisma/prisma.service";
import { BannedWordsService } from "./banned-words.service";

describe("BannedWordsService", () => {
  it("reloads after 60 seconds and when asked", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ word: "Ngu" }])
      .mockResolvedValueOnce([{ word: "spam" }])
      .mockResolvedValueOnce([{ word: "cấm" }]);
    const words = new BannedWordsService({ bannedWord: { findMany } } as unknown as PrismaService);

    await expect(words.current(1_000)).resolves.toEqual(["ngu"]);
    await expect(words.current(30_000)).resolves.toEqual(["ngu"]);
    expect(findMany).toHaveBeenCalledTimes(1);

    await expect(words.current(61_000)).resolves.toEqual(["spam"]);
    await words.refresh(70_000);
    await expect(words.current(70_000)).resolves.toEqual(["cấm"]);
    expect(findMany).toHaveBeenCalledTimes(3);
  });
});
