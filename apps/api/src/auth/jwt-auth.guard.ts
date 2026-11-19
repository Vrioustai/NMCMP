import type { UserProfile } from "@movie/contracts";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC } from "./auth.decorators";
import { passwordVersion } from "./password";
import { toProfile } from "./profile";
import { SESSION_COOKIE } from "./session-cookie";

type SessionPayload = { sub?: unknown; pv?: unknown };

type RequestWithUser = {
  cookies?: Record<string, unknown>;
  user?: UserProfile;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string" || token.length === 0) {
      if (isPublic) return true;
      throw new AppError("UNAUTHENTICATED");
    }

    const payload = this.readPayload(token);
    const user =
      payload === null ? null : await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!payload || !user || passwordVersion(user.passwordHash) !== payload.pv) {
      if (isPublic) return true;
      throw new AppError("UNAUTHENTICATED");
    }
    if (user.status === "LOCKED") throw new AppError("ACCOUNT_LOCKED");
    request.user = toProfile(user);
    return true;
  }

  private readPayload(token: string): { sub: number; pv: string } | null {
    try {
      const payload = this.jwt.verify<SessionPayload>(token);
      if (typeof payload.sub !== "number" || typeof payload.pv !== "string") return null;
      return { sub: payload.sub, pv: payload.pv };
    } catch {
      return null;
    }
  }
}
