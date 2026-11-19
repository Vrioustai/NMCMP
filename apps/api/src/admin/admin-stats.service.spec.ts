import type { PrismaService } from "../prisma/prisma.service";
import { AdminStatsService } from "./admin-stats.service";

describe("AdminStatsService", () => {
  it("keeps an empty day at zero and counts range views once", async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        { day: "2026-11-18", new_users: 0, views: 0, danmaku: 0, reports: 0 },
        { day: "2026-11-19", new_users: 1, views: 2, danmaku: 1, reports: 1 },
      ])
      .mockResolvedValueOnce([{ new_users: 1, views: 2, danmaku: 1, reports: 1 }])
      .mockResolvedValueOnce([{ id: 4, slug: "mot", title: "Một", poster_url: null, views: 2 }]);
    const stats = new AdminStatsService({ $queryRaw: queryRaw } as unknown as PrismaService);

    await expect(
      stats.get({ from: "2026-11-18", to: "2026-11-19" }, new Date("2026-11-19T04:00:00.000Z")),
    ).resolves.toEqual({
      from: "2026-11-18",
      to: "2026-11-19",
      days: [
        { day: "2026-11-18", newUsers: 0, views: 0, danmaku: 0, reports: 0 },
        { day: "2026-11-19", newUsers: 1, views: 2, danmaku: 1, reports: 1 },
      ],
      totals: { newUsers: 1, views: 2, danmaku: 1, reports: 1 },
      topMovies: [{ id: 4, slug: "mot", title: "Một", posterUrl: null, views: 2 }],
    });
    const text = sqlText(queryRaw.mock.calls[0][0]);
    expect(text).toContain("generate_series");
    expect(text).toContain("AT TIME ZONE 'UTC'");
    expect(text).toContain("Asia/Ho_Chi_Minh");
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it("rejects 91 days before querying", async () => {
    const queryRaw = jest.fn();
    const stats = new AdminStatsService({ $queryRaw: queryRaw } as unknown as PrismaService);
    await expect(
      stats.get({ from: "2026-08-20", to: "2026-11-19" }, new Date("2026-11-19T04:00:00.000Z")),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

function sqlText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const sql = value as { strings?: string[]; values?: unknown[] };
  return `${(sql.strings ?? []).join(" ")} ${(sql.values ?? []).map(sqlText).join(" ")}`;
}
