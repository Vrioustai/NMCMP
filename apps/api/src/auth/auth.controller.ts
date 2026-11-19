import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import { Public } from "./auth.decorators";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Parameters<AuthService["writeSession"]>[0],
  ) {
    const issued = await this.auth.register(dto);
    this.auth.writeSession(res, issued.token);
    return issued.profile;
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Parameters<AuthService["writeSession"]>[0],
  ) {
    const issued = await this.auth.login(dto);
    this.auth.writeSession(res, issued.token);
    return issued.profile;
  }

  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Parameters<AuthService["clearSession"]>[0]): void {
    this.auth.clearSession(res);
  }

  @Post("forgot-password")
  @HttpCode(202)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.requestPasswordReset(dto);
  }

  @Post("reset-password")
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto);
  }
}
