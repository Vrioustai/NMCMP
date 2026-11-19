import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const STATUS_TTL_MS = 30_000;

@Injectable()
export class AccountStatusService {
  private readonly cache = new Map<number, { status: string; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  remember(userId: number, status: string, now = Date.now()): void {
    this.cache.set(userId, { status, at: now });
  }

  // Lùi mốc để lần gửi sau phải đọc lại, không chờ hết 30 giây trong bài kiểm.
  expire(userId: number): void {
    const hit = this.cache.get(userId);
    if (hit) hit.at -= STATUS_TTL_MS;
  }

  async isActive(userId: number, now = Date.now()): Promise<boolean> {
    const hit = this.cache.get(userId);
    if (hit && now - hit.at < STATUS_TTL_MS) return hit.status === "ACTIVE";
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    const status = user?.status ?? "LOCKED";
    this.cache.set(userId, { status, at: now });
    return status === "ACTIVE";
  }
}
