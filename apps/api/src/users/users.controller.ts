import type { UserProfile } from "@movie/contracts";
import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { UpdateProfileDto } from "./users.dto";
import { UsersService } from "./users.service";

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  get(@CurrentUser() user: UserProfile): Promise<UserProfile> {
    return this.users.get(user.id);
  }

  @Patch("me")
  update(@CurrentUser() user: UserProfile, @Body() dto: UpdateProfileDto): Promise<UserProfile> {
    return this.users.update(user.id, dto);
  }
}
