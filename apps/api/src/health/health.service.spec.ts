import { Logger } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import { HealthService } from "./health.service";

function service(query: () => Promise<unknown>, ping: () => Promise<boolean>) {
  return new HealthService(
    { $queryRaw: query } as unknown as PrismaService,
    { ping } as unknown as RedisService,
  );
}

describe("HealthService", () => {
  let error: jest.Spied<Logger["error"]>;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => error.mockRestore());

  it("reports ok when both stores answer", async () => {
    const report = await service(
      async () => [1],
      async () => true,
    ).check();
    expect(report).toEqual({
      statusCode: 200,
      body: { status: "ok", postgres: "up", redis: "up" },
    });
  });

  it("stays up and degraded when only Redis is down", async () => {
    const report = await service(
      async () => [1],
      async () => false,
    ).check();
    expect(report.statusCode).toBe(200);
    expect(report.body).toEqual({ status: "degraded", postgres: "up", redis: "down" });
  });

  it("returns 503 when PostgreSQL fails and does not put the query in the body", async () => {
    const report = await service(
      async () => {
        throw new Error("SELECT secret_password FROM users");
      },
      async () => true,
    ).check();
    expect(report.statusCode).toBe(503);
    expect(report.body.postgres).toBe("down");
    expect(report.body.redis).toBe("up");
    expect(JSON.stringify(report.body)).not.toContain("SELECT");
    expect(error).toHaveBeenCalled();
  });
});
