import { Controller, Get, Res } from "@nestjs/common";
import { Public } from "../auth/auth.decorators";
import { HealthService } from "./health.service";

type StatusReply = { status(code: number): void };

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: StatusReply) {
    const report = await this.health.check();
    res.status(report.statusCode);
    return report.body;
  }
}
