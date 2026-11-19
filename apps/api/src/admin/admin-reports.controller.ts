import type { AdminReportList, UserProfile } from "@movie/contracts";
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AdminReportQueryDto, ReportDecisionDto } from "./admin-reports.dto";
import { AdminReportsService } from "./admin-reports.service";

@Roles("ADMIN")
@Controller("admin/reports")
export class AdminReportsController {
  constructor(private readonly reports: AdminReportsService) {}

  @Get()
  list(@Query() query: AdminReportQueryDto): Promise<AdminReportList> {
    return this.reports.list(query);
  }

  @Patch(":id")
  decide(
    @CurrentUser() actor: UserProfile,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReportDecisionDto,
  ): Promise<{ updated: number }> {
    return this.reports.decide(actor.id, id, dto.decision);
  }
}
