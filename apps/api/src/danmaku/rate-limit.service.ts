import { DANMAKU_COOLDOWN_MS } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

export type RateClaim = { ok: true } | { ok: false; retryAfterMs: number };

@Injectable()
export class RateLimitService {
  private readonly until = new Map<number, number>();

  constructor(private readonly redis: RedisService) {}

  async take(userId: number, now = Date.now()): Promise<RateClaim> {
    const claim = await this.redis.setNxPx(`danmaku:rl:${userId}`, "1", DANMAKU_COOLDOWN_MS);
    if (claim === "ok") return { ok: true };
    if (claim === "busy") {
      const ttl = await this.redis.pttl(`danmaku:rl:${userId}`);
      return { ok: false, retryAfterMs: ttl != null && ttl > 0 ? ttl : DANMAKU_COOLDOWN_MS };
    }
    return this.takeInMemory(userId, now);
  }

  // Redis lỗi thì vẫn chặn, bằng đồng hồ trong tiến trình này.
  private takeInMemory(userId: number, now: number): RateClaim {
    const until = this.until.get(userId) ?? 0;
    if (until > now) return { ok: false, retryAfterMs: until - now };
    this.until.set(userId, now + DANMAKU_COOLDOWN_MS);
    return { ok: true };
  }
}
