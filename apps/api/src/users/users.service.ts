import { isAvatarUrl, type UserProfile } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { toProfile } from "../auth/profile";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateProfileDto } from "./users.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: number): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("NOT_FOUND");
    return toProfile(user);
  }

  async update(userId: number, patch: UpdateProfileDto): Promise<UserProfile> {
    if (patch.avatarUrl != null && !isAvatarUrl(patch.avatarUrl)) {
      throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
        { field: "avatarUrl", message: "Ảnh đại diện không có trong danh sách" },
      ]);
    }

    const data: { displayName?: string; avatarUrl?: string | null } = {};
    if (patch.displayName !== undefined) data.displayName = patch.displayName;
    if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl;
    // Trường không có trong thân request thì không ghi, nên sửa tên không xóa ảnh.
    const user =
      Object.keys(data).length === 0
        ? await this.prisma.user.findUnique({ where: { id: userId } })
        : await this.prisma.user.update({ where: { id: userId }, data });
    if (!user) throw new AppError("NOT_FOUND");
    return toProfile(user);
  }
}
