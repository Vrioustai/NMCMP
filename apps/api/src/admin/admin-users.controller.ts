import type { AdminUserList, UserProfile } from "@movie/contracts";
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AdminUserQueryDto, UserStatusDto } from "./admin-users.dto";
import { AdminUsersService } from "./admin-users.service";

@Roles("ADMIN")
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminUserQueryDto): Promise<AdminUserList> {
    return this.users.list(query);
  }

  @Patch(":id/status")
  setStatus(
    @CurrentUser() actor: UserProfile,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UserStatusDto,
  ): Promise<{ id: number; status: UserStatusDto["status"] }> {
    return this.users.setStatus(actor.id, id, dto.status);
  }
}
