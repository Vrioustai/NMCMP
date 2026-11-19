import {
  PAGE_SIZE_DEFAULT,
  type AdminUser,
  type AdminUserList,
  type UserStatus,
} from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminUserQueryDto } from "./admin-users.dto";

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminUserQueryDto): Promise<AdminUserList> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? PAGE_SIZE_DEFAULT;
    const text = query.q
      ? {
          OR: [
            { displayName: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const where = { ...text, ...(query.status ? { status: query.status } : {}) };
    const [total, rows, all, active, locked] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where: text }),
      this.prisma.user.count({ where: { ...text, status: "ACTIVE" } }),
      this.prisma.user.count({ where: { ...text, status: "LOCKED" } }),
    ]);
    const ids = rows.map((row) => row.id);
    const [warnings, activity] = await Promise.all([
      this.warningCounts(ids),
      this.lastActivity(ids),
    ]);
    const items: AdminUser[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: activity.get(row.id) ?? null,
      warningCount: warnings.get(row.id) ?? 0,
    }));
    return { items, page, pageSize, total, counts: { all, active, locked } };
  }

  async setStatus(
    actorId: number,
    userId: number,
    status: UserStatus,
  ): Promise<{ id: number; status: UserStatus }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new AppError("NOT_FOUND");
    // Không khóa quản trị viên, và không tự khóa chính mình.
    if (status === "LOCKED" && (user.role === "ADMIN" || user.id === actorId)) {
      throw new AppError("CANNOT_LOCK_ADMIN");
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { status } });
    return { id: user.id, status };
  }

  private async warningCounts(ids: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (ids.length === 0) return counts;
    // groupBy của Prisma không nhóm được qua danmaku, nên một câu GROUP BY theo người gửi.
    const rows = await this.prisma.$queryRaw<{ userId: number; warningCount: number }[]>(
      Prisma.sql`
        SELECT d.user_id AS "userId", COUNT(*)::int AS "warningCount"
        FROM reports r
        JOIN danmakus d ON d.id_danmaku = r.danmaku_id
        WHERE r.action = 'WARN'::moderation_action
          AND d.user_id IN (${Prisma.join(ids)})
        GROUP BY d.user_id
      `,
    );
    for (const row of rows) counts.set(Number(row.userId), Number(row.warningCount));
    return counts;
  }

  private async lastActivity(ids: number[]): Promise<Map<number, string>> {
    const activity = new Map<number, string>();
    if (ids.length === 0) return activity;
    const rows = await this.prisma.watchHistory.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { updatedAt: true },
    });
    for (const row of rows) {
      if (row._max.updatedAt) activity.set(row.userId, row._max.updatedAt.toISOString());
    }
    return activity;
  }
}
