import type { PrismaService } from "../prisma/prisma.service";
import { AccountStatusService } from "./account-status.service";

describe("AccountStatusService", () => {
  it("keeps the cached status for 30 seconds, then reads again", async () => {
    const findUnique = jest.fn().mockResolvedValue({ status: "LOCKED" });
    const accounts = new AccountStatusService({
      user: { findUnique },
    } as unknown as PrismaService);
    accounts.remember(3, "ACTIVE", 1_000);

    await expect(accounts.isActive(3, 30_999)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();

    await expect(accounts.isActive(3, 31_000)).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(1);
    await expect(accounts.isActive(3, 40_000)).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("treats a missing account as locked", async () => {
    const accounts = new AccountStatusService({
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);
    await expect(accounts.isActive(9, 1)).resolves.toBe(false);
  });
});
