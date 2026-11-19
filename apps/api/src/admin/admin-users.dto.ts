import { PAGE_SIZE_MAX, SEARCH_QUERY_MAX_LENGTH, type UserStatus } from "@movie/contracts";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const USER_STATUSES = ["ACTIVE", "LOCKED"] as const;

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  return text === "" ? undefined : text;
}

export class AdminUserQueryDto {
  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsString({ message: "Từ khóa không hợp lệ" })
  @MaxLength(SEARCH_QUERY_MAX_LENGTH, { message: "Từ khóa dài quá 100 ký tự" })
  q?: string;

  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsIn(USER_STATUSES, { message: "Trạng thái không hợp lệ" })
  status?: UserStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Trang không hợp lệ" })
  @Min(1, { message: "Trang không hợp lệ" })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Số dòng không hợp lệ" })
  @Min(1, { message: "Số dòng không hợp lệ" })
  @Max(PAGE_SIZE_MAX, { message: "Số dòng không hợp lệ" })
  pageSize?: number;
}

export class UserStatusDto {
  @IsIn(USER_STATUSES, { message: "Trạng thái không hợp lệ" })
  status!: UserStatus;
}
