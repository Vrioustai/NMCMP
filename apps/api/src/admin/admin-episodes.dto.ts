import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
  ValidateIf,
} from "class-validator";

const TITLE_MAX = 200;
const URL_MAX = 2_000;
const STREAM_UID_MAX = 128;

function trimmed(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function directHttps(value: unknown): boolean {
  if (typeof value !== "string") return false;
  let host: string;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    host = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host !== "drive.google.com" &&
    host !== "docs.google.com" &&
    !host.endsWith(".drive.google.com") &&
    !host.endsWith(".docs.google.com")
  );
}

export class CreateEpisodeDto {
  @IsOptional()
  @IsInt({ message: "Mùa không hợp lệ" })
  @Min(1, { message: "Mùa không hợp lệ" })
  @Max(99, { message: "Mùa không hợp lệ" })
  seasonNumber?: number;

  @IsInt({ message: "Số tập không hợp lệ" })
  @Min(1, { message: "Số tập không hợp lệ" })
  @Max(9_999, { message: "Số tập không hợp lệ" })
  number!: number;

  @IsOptional()
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tên tập không hợp lệ" })
  @MinLength(1, { message: "Tên tập không hợp lệ" })
  @MaxLength(TITLE_MAX, { message: "Tên tập dài quá 200 ký tự" })
  title?: string | null;
}

export class UpdateEpisodeDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsInt({ message: "Mùa không hợp lệ" })
  @Min(1, { message: "Mùa không hợp lệ" })
  @Max(99, { message: "Mùa không hợp lệ" })
  seasonNumber?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt({ message: "Số tập không hợp lệ" })
  @Min(1, { message: "Số tập không hợp lệ" })
  @Max(9_999, { message: "Số tập không hợp lệ" })
  number?: number;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tên tập không hợp lệ" })
  @MinLength(1, { message: "Tên tập không hợp lệ" })
  @MaxLength(TITLE_MAX, { message: "Tên tập dài quá 200 ký tự" })
  title?: string | null;
}

export class SetStreamDto {
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Mã video không hợp lệ" })
  @MinLength(1, { message: "Thiếu mã video" })
  @MaxLength(STREAM_UID_MAX, { message: "Mã video dài quá 128 ký tự" })
  streamUid!: string;
}

export class DirectUploadDto {
  @IsOptional()
  @IsInt({ message: "Thời lượng tối đa không hợp lệ" })
  @Min(1, { message: "Thời lượng tối đa không hợp lệ" })
  @Max(21_600, { message: "Thời lượng tối đa không hợp lệ" })
  maxDurationSeconds?: number;
}

export class StreamCopyDto {
  @Transform(({ value }) => trimmed(value))
  @IsUrl(
    { protocols: ["https"], require_protocol: true },
    { message: "Link video phải là URL https" },
  )
  @MaxLength(URL_MAX, { message: "Link video dài quá 2000 ký tự" })
  @ValidateBy({
    name: "directHttps",
    validator: {
      validate: directHttps,
      defaultMessage: () => "Không nhận link Google Drive",
    },
  })
  url!: string;
}
