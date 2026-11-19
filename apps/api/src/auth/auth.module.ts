import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import type { ApiEnv } from "../config/env.schema";
import { MailModule } from "../mail/mail.module";
import { AdminAccessController } from "./admin-access.controller";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<ApiEnv, true>) => ({
        secret: config.getOrThrow("JWT_SECRET"),
        signOptions: {
          algorithm: "HS256",
          expiresIn: config.getOrThrow("SESSION_TTL_DAYS") * 24 * 60 * 60,
        },
      }),
    }),
  ],
  controllers: [AuthController, AdminAccessController],
  exports: [JwtModule],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
