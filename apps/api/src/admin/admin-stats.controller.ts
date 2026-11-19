import type { AdminStats } from "@movie/contracts";
import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
import { AdminStatsQueryDto } from "./admin-stats.dto";
import { AdminStatsService } from "./admin-stats.service";

@Roles("ADMIN")
@Controller("admin/stats")
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get()
  get(@Query() query: AdminStatsQueryDto): Promise<AdminStats> {
    return this.stats.get(query);
  }
}
