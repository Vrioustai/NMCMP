import { AVATAR_URLS, DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH } from "@movie/contracts";
import { Transform } from "class-transformer";
import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

function trimmed(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

// Không gửi trường thì giữ nguyên. null chỉ hợp lệ với ảnh, vì tên không được xóa.
export class UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tên hiển thị không hợp lệ" })
  @MinLength(DISPLAY_NAME_MIN_LENGTH, { message: "Tên hiển thị cần từ 2 ký tự" })
  @MaxLength(DISPLAY_NAME_MAX_LENGTH, { message: "Tên hiển thị dài quá 40 ký tự" })
  displayName?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsIn(AVATAR_URLS, { message: "Ảnh đại diện không có trong danh sách" })
  avatarUrl?: string | null;
}
