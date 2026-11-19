import type { PrismaService } from "../prisma/prisma.service";
import { AdminUsersService } from "./admin-users.service";

describe("AdminUsersService", () => {
  const createdAt = new Date("2026-11-01T03:00:00.000Z");
  const watchedAt = new Date("2026-11-19T08:30:00.000Z");

  function service(overrides: Record<string, unknown> = {}) {
    const prisma = {
      user: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      watchHistory: { groupBy: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      ...overrides,
    };
    return {
      prisma,
      users: new AdminUsersService(prisma as unknown as PrismaService),
    };
  }

  it("counts warnings once and takes the latest watch as last activity", async () => {
    const { prisma, users } = service();
    prisma.user.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 4,
        email: "xem@filmgenz.test",
        displayName: "Người xem",
        role: "USER",
        status: "ACTIVE",
        createdAt,
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ userId: 4, warningCount: 2 }]);
    prisma.watchHistory.groupBy.mockResolvedValue([{ userId: 4, _max: { updatedAt: watchedAt } }]);

    await expect(
      users.list({ q: "xem", status: "ACTIVE", page: 1, pageSize: 24 }),
    ).resolves.toEqual({
      items: [
        {
          id: 4,
          email: "xem@filmgenz.test",
          displayName: "Người xem",
          role: "USER",
          status: "ACTIVE",
          createdAt: createdAt.toISOString(),
          lastActiveAt: watchedAt.toISOString(),
          warningCount: 2,
        },
      ],
      page: 1,
      pageSize: 24,
      total: 1,
      counts: { all: 2, active: 2, locked: 0 },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.watchHistory.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { displayName: { contains: "xem", mode: "insensitive" } },
            { email: { contains: "xem", mode: "insensitive" } },
          ],
          status: "ACTIVE",
        },
      }),
    );
  });

  it("skips the aggregates when the page is empty", async () => {
    const { prisma, users } = service();
    await expect(users.list({})).resolves.toMatchObject({ items: [], pageSize: 24 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.watchHistory.groupBy).not.toHaveBeenCalled();
  });

  it("locks a member and refuses an admin or the actor", async () => {
    const { prisma, users } = service();
    prisma.user.findUnique.mockResolvedValue({ id: 4, role: "USER" });
    await expect(users.setStatus(1, 4, "LOCKED")).resolves.toEqual({ id: 4, status: "LOCKED" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { status: "LOCKED" },
    });

    prisma.user.findUnique.mockResolvedValueOnce({ id: 2, role: "ADMIN" });
    await expect(users.setStatus(1, 2, "LOCKED")).rejects.toMatchObject({
      code: "CANNOT_LOCK_ADMIN",
    });

    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, role: "USER" });
    await expect(users.setStatus(1, 1, "LOCKED")).rejects.toMatchObject({
      code: "CANNOT_LOCK_ADMIN",
    });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);

    prisma.user.findUnique.mockResolvedValueOnce({ id: 2, role: "ADMIN" });
    await expect(users.setStatus(1, 2, "ACTIVE")).resolves.toEqual({ id: 2, status: "ACTIVE" });

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(users.setStatus(1, 9, "LOCKED")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
