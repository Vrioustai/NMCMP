import type { Role, UserProfile } from "@movie/contracts";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError } from "../common/app-error";
import { ROLES_KEY } from "./auth.decorators";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<{ user?: UserProfile }>();
    if (!request.user) throw new AppError("UNAUTHENTICATED");
    if (!roles.includes(request.user.role)) throw new AppError("FORBIDDEN");
    return true;
  }
}
