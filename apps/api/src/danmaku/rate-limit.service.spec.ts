import type { RedisService } from "../redis/redis.service";
import { RateLimitService } from "./rate-limit.service";

describe("RateLimitService", () => {
  it("uses Redis, then the remaining time, then the in-memory clock", async () => {
    const setNxPx = jest
      .fn()
      .mockResolvedValueOnce("ok")
      .mockResolvedValueOnce("busy")
      .mockResolvedValue("down");
    const pttl = jest.fn().mockResolvedValue(1200);
    const limits = new RateLimitService({ setNxPx, pttl } as unknown as RedisService);

    await expect(limits.take(4, 10_000)).resolves.toEqual({ ok: true });
    await expect(limits.take(4, 10_000)).resolves.toEqual({ ok: false, retryAfterMs: 1200 });
    await expect(limits.take(4, 10_000)).resolves.toEqual({ ok: true });
    await expect(limits.take(4, 11_000)).resolves.toEqual({ ok: false, retryAfterMs: 2000 });
    await expect(limits.take(4, 13_000)).resolves.toEqual({ ok: true });
  });
});
