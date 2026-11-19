import type { BannedWord } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BannedWordsService } from "../danmaku/banned-words.service";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";

const WORD_MAX = 40;

const wordInclude = {
  creator: { select: { displayName: true } },
} satisfies Prisma.BannedWordInclude;

type WordRow = Prisma.BannedWordGetPayload<{ include: typeof wordInclude }>;

@Injectable()
export class AdminWordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: BannedWordsService,
  ) {}

  async list(): Promise<BannedWord[]> {
    const rows = await this.prisma.bannedWord.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: wordInclude,
    });
    return rows.map(toItem);
  }

  async create(actorId: number, raw: string): Promise<BannedWord> {
    const word = cleanWord(raw);
    try {
      const row = await this.prisma.bannedWord.create({
        data: { word, creatorUserId: actorId },
        include: wordInclude,
      });
      await this.cache.refresh();
      return toItem(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("WORD_TAKEN");
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const row = await this.prisma.bannedWord.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new AppError("NOT_FOUND");
    await this.prisma.bannedWord.delete({ where: { id } });
    await this.cache.refresh();
  }
}

function cleanWord(value: string): string {
  const word = value
    .normalize("NFC")
    .replace(/\p{Cc}/gu, "")
    .trim()
    .toLowerCase();
  const length = Array.from(word).length;
  if (length < 1 || length > WORD_MAX) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "word", message: "Từ cần từ 1 đến 40 ký tự" },
    ]);
  }
  return word;
}

function toItem(row: WordRow): BannedWord {
  return {
    id: row.id,
    word: row.word,
    createdAt: row.createdAt.toISOString(),
    creator: { displayName: row.creator.displayName },
  };
}
