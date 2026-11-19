import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  return text === "" ? undefined : text;
}

export class AdminStatsQueryDto {
  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsString({ message: "Ngày không hợp lệ" })
  @MaxLength(10, { message: "Ngày không hợp lệ" })
  from?: string;

  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsString({ message: "Ngày không hợp lệ" })
  @MaxLength(10, { message: "Ngày không hợp lệ" })
  to?: string;
}
