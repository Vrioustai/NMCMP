import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

const NAME_MAX = 80;

function trimmed(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateGenreDto {
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tên thể loại không hợp lệ" })
  @MinLength(1, { message: "Thiếu tên thể loại" })
  @MaxLength(NAME_MAX, { message: "Tên thể loại dài quá 80 ký tự" })
  name!: string;
}

export class UpdateGenreDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tên thể loại không hợp lệ" })
  @MinLength(1, { message: "Thiếu tên thể loại" })
  @MaxLength(NAME_MAX, { message: "Tên thể loại dài quá 80 ký tự" })
  name?: string;
}
