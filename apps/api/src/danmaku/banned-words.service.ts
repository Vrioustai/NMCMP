import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const REFRESH_MS = 60_000;

@Injectable()
export class BannedWordsService {
  private words: string[] = [];
  private loadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async current(now = Date.now()): Promise<readonly string[]> {
    if (this.loadedAt === 0 || now - this.loadedAt >= REFRESH_MS) await this.refresh(now);
    return this.words;
  }

  // Quản trị thêm hoặc xóa từ thì gọi ngay, không chờ hết 60 giây.
  async refresh(now = Date.now()): Promise<void> {
    const rows = await this.prisma.bannedWord.findMany({ select: { word: true } });
    this.words = rows.map((row) => row.word.normalize("NFC").toLowerCase());
    this.loadedAt = now;
  }
}
