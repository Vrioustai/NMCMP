import {
  PAGE_SIZE_DEFAULT,
  type AdminReport,
  type AdminReportList,
  type ModerationDecision,
} from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminReportQueryDto } from "./admin-reports.dto";

const HANDLED = ["RESOLVED", "REJECTED"] as const;

const reportInclude = {
  danmaku: {
    select: {
      id: true,
      content: true,
      timeMs: true,
      user: { select: { displayName: true } },
      episode: {
        select: {
          seasonNumber: true,
          number: true,
          movie: { select: { title: true } },
        },
      },
    },
  },
} satisfies Prisma.ReportInclude;

type ReportRow = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminReportQueryDto): Promise<AdminReportList> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? PAGE_SIZE_DEFAULT;
    const where =
      query.status === "HANDLED"
        ? { status: { in: [...HANDLED] } }
        : { status: "PENDING" as const };
    const [total, rows, pending, handled] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: reportInclude,
      }),
      this.prisma.report.count({ where: { status: "PENDING" } }),
      this.prisma.report.count({ where: { status: { in: [...HANDLED] } } }),
    ]);
    const counts = await this.reportCounts(rows.map((row) => row.danmakuId));
    return {
      items: rows.map((row) => toItem(row, counts.get(row.danmakuId) ?? 0)),
      page,
      pageSize,
      total,
      counts: { pending, handled },
    };
  }

  async decide(
    actorId: number,
    reportId: number,
    decision: ModerationDecision,
  ): Promise<{ updated: number }> {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, danmakuId: true },
      });
      if (!report || report.status !== "PENDING") throw new AppError("NOT_FOUND");
      if (decision === "HIDE") {
        await tx.danmaku.update({ where: { id: report.danmakuId }, data: { isHidden: true } });
      } else if (decision === "DELETE") {
        await tx.danmaku.update({
          where: { id: report.danmakuId },
          data: { deletedAt: new Date() },
        });
      }
      // Một quyết định đóng mọi báo cáo đang chờ của cùng Danmaku.
      const updated = await tx.report.updateMany({
        where: { danmakuId: report.danmakuId, status: "PENDING" },
        data: {
          status: decision === "REJECT" ? "REJECTED" : "RESOLVED",
          action: decision === "REJECT" ? null : decision,
          resolverUserId: actorId,
          resolvedAt: new Date(),
        },
      });
      return { updated: updated.count };
    });
  }

  private async reportCounts(danmakuIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    const ids = [...new Set(danmakuIds)];
    if (ids.length === 0) return counts;
    const rows = await this.prisma.report.groupBy({
      by: ["danmakuId"],
      where: { danmakuId: { in: ids } },
      _count: true,
    });
    for (const row of rows) counts.set(row.danmakuId, row._count);
    return counts;
  }
}

function toItem(row: ReportRow, reportCount: number): AdminReport {
  return {
    id: row.id,
    status: row.status,
    action: row.action,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    danmaku: { id: row.danmaku.id, content: row.danmaku.content, timeMs: row.danmaku.timeMs },
    movie: { title: row.danmaku.episode.movie.title },
    episode: {
      seasonNumber: row.danmaku.episode.seasonNumber,
      number: row.danmaku.episode.number,
    },
    sender: { displayName: row.danmaku.user.displayName },
    reportCount,
  };
}
