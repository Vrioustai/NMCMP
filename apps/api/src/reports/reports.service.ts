import { REPORT_MAX_LENGTH } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { requireVisibleDanmaku } from "../catalog/catalog-access";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateReportDto } from "./reports.dto";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateReportDto): Promise<{ id: number }> {
    const reason = cleanReason(dto.reason);
    const danmaku = await requireVisibleDanmaku(this.prisma, dto.danmakuId);
    if (danmaku.userId === userId) throw new AppError("FORBIDDEN");
    try {
      // Báo lần hai dựa vào UNIQUE. Đọc trước rồi mới ghi sẽ lọt hai request cùng lúc.
      const row = await this.prisma.report.create({
        data: { reporterUserId: userId, danmakuId: danmaku.id, reason },
      });
      return { id: row.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("ALREADY_REPORTED");
      }
      throw error;
    }
  }
}

function cleanReason(value: string): string {
  const reason = value
    .normalize("NFC")
    .replace(/\p{Cc}/gu, "")
    .trim();
  const length = Array.from(reason).length;
  if (length < 1 || length > REPORT_MAX_LENGTH) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "reason", message: "Lý do cần từ 1 đến 200 ký tự" },
    ]);
  }
  return reason;
}
