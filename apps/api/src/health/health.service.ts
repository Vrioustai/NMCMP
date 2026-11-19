import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

export type HealthReport = {
  statusCode: 200 | 503;
  body: {
    status: "ok" | "degraded" | "down";
    postgres: "up" | "down";
    redis: "up" | "down";
  };
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthReport> {
    const [postgres, redisUp] = await Promise.all([this.postgresUp(), this.redis.ping()]);
    const redis = redisUp ? "up" : "down";
    if (!postgres) {
      return { statusCode: 503, body: { status: "down", postgres: "down", redis } };
    }
    return {
      statusCode: 200,
      body: { status: redisUp ? "ok" : "degraded", postgres: "up", redis },
    };
  }

  private async postgresUp(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        "PostgreSQL không trả lời",
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
