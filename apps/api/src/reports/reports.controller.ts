import type { UserProfile } from "@movie/contracts";
import { Body, Controller, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { CreateReportDto } from "./reports.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(@CurrentUser() user: UserProfile, @Body() dto: CreateReportDto): Promise<{ id: number }> {
    return this.reports.create(user.id, dto);
  }
}
