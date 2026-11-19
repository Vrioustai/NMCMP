import type { UserProfile } from "@movie/contracts";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AppError } from "../common/app-error";
import { Clock } from "../common/clock";
import type { ApiEnv } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import type { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./auth.dto";
import { hashPassword, passwordVersion, timingPadHash, verifyPassword } from "./password";
import { assertBirthYear, toProfile } from "./profile";
import { createResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from "./reset-token";
import { clearSessionCookie, writeSessionCookie } from "./session-cookie";

type SessionPayload = { sub: number; pv: string };

export type IssuedSession = { profile: UserProfile; token: string };

@Injectable()
export class AuthService implements OnModuleInit {
  private timingHash = "";

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<ApiEnv, true>,
    private readonly mail: MailService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.timingHash = await timingPadHash();
  }

  async register(dto: RegisterDto): Promise<IssuedSession> {
    assertBirthYear(dto.birthYear, this.currentYear());
    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        birthYear: dto.birthYear,
        role: "USER",
      },
    });
    return { profile: toProfile(user), token: this.sign(user.id, passwordHash) };
  }

  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const passwordHash = user?.passwordHash ?? this.timingHash;
    const matches = await verifyPassword(passwordHash, dto.password);
    if (!user || !matches) throw new AppError("INVALID_CREDENTIALS");
    if (user.status === "LOCKED") throw new AppError("ACCOUNT_LOCKED");
    return { profile: toProfile(user), token: this.sign(user.id, user.passwordHash) };
  }

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const now = this.now();
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (!user) return;

    const token = createResetToken();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
      });
    });
    const link = `${this.config.getOrThrow("WEB_ORIGIN")}/reset-password?token=${encodeURIComponent(token)}`;
    // SMTP chạy sau khi hàm này trả về, nên email không có cũng không chậm hơn email có.
    this.mail.sendPasswordReset(dto.email, link);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const now = this.now();
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(dto.token) },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
      throw new AppError("RESET_TOKEN_INVALID");
    }
    const same = await verifyPassword(row.user.passwordHash, dto.newPassword).catch(() => false);
    if (same) {
      throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
        { field: "newPassword", message: "Mật khẩu mới phải khác mật khẩu hiện tại" },
      ]);
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new AppError("RESET_TOKEN_INVALID");
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    });
  }

  writeSession(res: Parameters<typeof writeSessionCookie>[0], token: string): void {
    writeSessionCookie(res, token, this.config.getOrThrow("COOKIE_SECURE"), this.maxAgeMs());
  }

  clearSession(res: Parameters<typeof clearSessionCookie>[0]): void {
    clearSessionCookie(res, this.config.getOrThrow("COOKIE_SECURE"));
  }

  private sign(userId: number, passwordHash: string): string {
    const payload: SessionPayload = { sub: userId, pv: passwordVersion(passwordHash) };
    return this.jwt.sign(payload);
  }

  private currentYear(): number {
    return Clock.start(this.config.getOrThrow("TZ_APP")).year();
  }

  private now(): Date {
    return new Date(Clock.start(this.config.getOrThrow("TZ_APP")).now().getTime());
  }

  private maxAgeMs(): number {
    return this.config.getOrThrow("SESSION_TTL_DAYS") * 24 * 60 * 60 * 1000;
  }
}
