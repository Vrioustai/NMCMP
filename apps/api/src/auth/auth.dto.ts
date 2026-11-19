import {
  BIRTH_YEAR_MIN,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from "@movie/contracts";
import { Transform } from "class-transformer";
import { IsEmail, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

function trimmed(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class RegisterDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Email không hợp lệ" })
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: "Mật khẩu cần từ 8 ký tự" })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: "Mật khẩu dài quá 72 ký tự" })
  @Matches(PASSWORD_PATTERN, { message: "Mật khẩu cần chữ hoa, chữ thường và chữ số" })
  password!: string;

  @Transform(({ value }) => trimmed(value))
  @IsString()
  @MinLength(DISPLAY_NAME_MIN_LENGTH, { message: "Tên hiển thị cần từ 2 ký tự" })
  @MaxLength(DISPLAY_NAME_MAX_LENGTH, { message: "Tên hiển thị dài quá 40 ký tự" })
  displayName!: string;

  @IsInt({ message: "Năm sinh không hợp lệ" })
  @Min(BIRTH_YEAR_MIN, { message: "Năm sinh không hợp lệ" })
  @Max(2100, { message: "Năm sinh không hợp lệ" })
  birthYear!: number;
}

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Email không hợp lệ" })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: "Thiếu mã đặt lại mật khẩu" })
  @MaxLength(128, { message: "Mã đặt lại mật khẩu không hợp lệ" })
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: "Mật khẩu cần từ 8 ký tự" })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: "Mật khẩu dài quá 72 ký tự" })
  @Matches(PASSWORD_PATTERN, { message: "Mật khẩu cần chữ hoa, chữ thường và chữ số" })
  newPassword!: string;
}

export class LoginDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Email không hợp lệ" })
  email!: string;

  @IsString()
  @MinLength(1, { message: "Thiếu mật khẩu" })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: "Mật khẩu dài quá 72 ký tự" })
  password!: string;
}
