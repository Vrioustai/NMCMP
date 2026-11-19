import type { Role, UserProfile } from "@movie/contracts";
import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";
export const ROLES_KEY = "roles";

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserProfile | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: UserProfile }>();
    return request.user;
  },
);
