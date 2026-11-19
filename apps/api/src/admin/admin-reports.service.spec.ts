import type { PrismaService } from "../prisma/prisma.service";
import { AdminReportsService } from "./admin-reports.service";

const createdAt = new Date("2026-11-19T02:00:00.000Z");

function row(id: number, danmakuId: number) {
  return {
    id,
    status: "PENDING",
    action: null,
    reason: "Không phù hợp",
    createdAt,
    danmakuId,
    danmaku: {
      id: danmakuId,
      content: "xin chao",
      timeMs: 310_000,
      user: { displayName: "Người gửi" },
      episode: { seasonNumber: 1, number: 2, movie: { title: "Phim một" } },
    },
  };
}

describe("AdminReportsService", () => {
  function harness() {
    const report = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    };
    const danmaku = { update: jest.fn().mockResolvedValue({}) };
    const prisma = {
      report,
      danmaku,
      $transaction: jest.fn(async (run: (tx: unknown) => Promise<unknown>) =>
        run({ report, danmaku }),
      ),
    };
    return {
      report,
      danmaku,
      reports: new AdminReportsService(prisma as unknown as PrismaService),
    };
  }

  it("lists a report with the shared count from one groupBy", async () => {
    const { report, reports } = harness();
    report.count.mockResolvedValueOnce(1).mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    report.findMany.mockResolvedValue([row(8, 3), row(9, 3)]);
    report.groupBy.mockResolvedValue([{ danmakuId: 3, _count: 3 }]);

    const page = await reports.list({ status: "PENDING", page: 1, pageSize: 24 });

    expect(page.items).toEqual([
      expect.objectContaining({
        id: 8,
        reportCount: 3,
        sender: { displayName: "Người gửi" },
        movie: { title: "Phim một" },
        danmaku: { id: 3, content: "xin chao", timeMs: 310_000 },
      }),
      expect.objectContaining({ id: 9, reportCount: 3 }),
    ]);
    expect(page.counts).toEqual({ pending: 4, handled: 2 });
    expect(report.groupBy).toHaveBeenCalledTimes(1);
    expect(report.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["danmakuId"], where: { danmakuId: { in: [3] } } }),
    );
  });

  it("skips the groupBy when the queue is empty", async () => {
    const { report, reports } = harness();
    await reports.list({});
    expect(report.groupBy).not.toHaveBeenCalled();

    await reports.list({ status: "HANDLED" });
    expect(report.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: { in: ["RESOLVED", "REJECTED"] } } }),
    );
  });

  it("applies one decision to every pending report of the danmaku", async () => {
    const { report, danmaku, reports } = harness();
    report.findUnique.mockResolvedValue({ id: 8, status: "PENDING", danmakuId: 3 });

    await expect(reports.decide(1, 8, "HIDE")).resolves.toEqual({ updated: 3 });
    expect(danmaku.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { isHidden: true } });
    expect(report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { danmakuId: 3, status: "PENDING" },
        data: expect.objectContaining({ status: "RESOLVED", action: "HIDE", resolverUserId: 1 }),
      }),
    );

    danmaku.update.mockClear();
    await reports.decide(1, 8, "DELETE");
    expect(danmaku.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );

    danmaku.update.mockClear();
    await reports.decide(1, 8, "WARN");
    expect(danmaku.update).not.toHaveBeenCalled();
    expect(report.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED", action: "WARN" }),
      }),
    );

    await reports.decide(1, 8, "REJECT");
    expect(report.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED", action: null }),
      }),
    );

    report.findUnique.mockResolvedValueOnce({ id: 8, status: "RESOLVED", danmakuId: 3 });
    await expect(reports.decide(1, 8, "HIDE")).rejects.toMatchObject({ code: "NOT_FOUND" });
    report.findUnique.mockResolvedValueOnce(null);
    await expect(reports.decide(1, 8, "HIDE")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
