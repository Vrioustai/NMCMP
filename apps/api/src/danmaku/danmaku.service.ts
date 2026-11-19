import type { DanmakuItem, DanmakuRejectReason, UserProfile } from "@movie/contracts";
import { Injectable, Logger } from "@nestjs/common";
import { requireWatchableEpisode } from "../catalog/catalog-access";
import { Clock } from "../common/clock";
import { PrismaService } from "../prisma/prisma.service";
import { AccountStatusService } from "./account-status.service";
import { BannedWordsService } from "./banned-words.service";
import { containsBannedWord, exceedsDanmakuLength, normalizeDanmaku } from "./danmaku-text";
import { RateLimitService } from "./rate-limit.service";

const LIST_LIMIT = 5_000;

export type SendInput = {
  userId: number;
  episodeId: unknown;
  joinedEpisodeId: number | null;
  durationSec: number | null;
  content: unknown;
  timeMs: unknown;
  now?: number;
};

export type SendResult =
  | { kind: "invalid"; episodeId: number }
  | { kind: "locked"; episodeId: number }
  | { kind: "rejected"; episodeId: number; reason: DanmakuRejectReason; retryAfterMs?: number }
  | {
      kind: "saved";
      episodeId: number;
      message: DanmakuItem & { createdAt: string };
    };

@Injectable()
export class DanmakuService {
  private readonly logger = new Logger(DanmakuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountStatusService,
    private readonly words: BannedWordsService,
    private readonly rates: RateLimitService,
  ) {}

  async send(input: SendInput): Promise<SendResult> {
    const started = Date.now();
    const episodeId = integer(input.episodeId) ?? 0;
    const active = await this.accounts.isActive(input.userId, input.now);
    if (!active) {
      this.log(started, episodeId, input.userId, "rejected", "LOCKED");
      return { kind: "locked", episodeId };
    }

    const content = normalizeDanmaku(input.content);
    const timeMs = integer(input.timeMs);
    const joined = input.joinedEpisodeId === episodeId && episodeId > 0;
    const timeOk =
      timeMs != null &&
      timeMs >= 0 &&
      (input.durationSec == null || timeMs <= input.durationSec * 1000);
    if (!joined || !timeOk || content.length === 0) {
      this.log(started, episodeId, input.userId, "rejected");
      return { kind: "invalid", episodeId };
    }

    if (exceedsDanmakuLength(content)) {
      this.log(started, episodeId, input.userId, "rejected", "TOO_LONG");
      return { kind: "rejected", episodeId, reason: "TOO_LONG" };
    }

    if (containsBannedWord(content, await this.words.current(input.now))) {
      this.log(started, episodeId, input.userId, "rejected", "BANNED_WORD");
      return { kind: "rejected", episodeId, reason: "BANNED_WORD" };
    }

    const claim = await this.rates.take(input.userId, input.now);
    if (!claim.ok) {
      this.log(started, episodeId, input.userId, "rejected", "RATE_LIMIT");
      return {
        kind: "rejected",
        episodeId,
        reason: "RATE_LIMIT",
        retryAfterMs: claim.retryAfterMs,
      };
    }

    const row = await this.prisma.danmaku.create({
      data: { episodeId, userId: input.userId, content, timeMs },
      select: { id: true, content: true, timeMs: true, createdAt: true },
    });
    this.log(started, episodeId, input.userId, "ok");
    return {
      kind: "saved",
      episodeId,
      message: {
        id: row.id,
        content: row.content,
        timeMs: row.timeMs,
        createdAt: row.createdAt.toISOString(),
      },
    };
  }

  async list(episodeId: number, viewer: UserProfile, now = new Date()): Promise<DanmakuItem[]> {
    await requireWatchableEpisode(this.prisma, episodeId, {
      birthYear: viewer.birthYear,
      year: new Clock(now).year(),
    });
    return this.prisma.danmaku.findMany({
      where: { episodeId, isHidden: false, deletedAt: null },
      orderBy: [{ timeMs: "asc" }, { id: "asc" }],
      take: LIST_LIMIT,
      select: { id: true, content: true, timeMs: true },
    });
  }

  private log(
    started: number,
    episodeId: number,
    userId: number,
    result: "ok" | "rejected",
    reason?: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: "danmaku.send",
        episodeId,
        userId,
        result,
        ...(reason ? { reason } : {}),
        durationMs: Date.now() - started,
      }),
    );
  }
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
