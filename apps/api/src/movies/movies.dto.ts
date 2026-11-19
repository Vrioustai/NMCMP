import { PAGE_SIZE_MAX, SEARCH_QUERY_MAX_LENGTH } from "@movie/contracts";
import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const YEAR_MIN = 1888;
const YEAR_MAX = 2100;

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  return text === "" ? undefined : text;
}

export class MovieListQueryDto {
  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsString({ message: "Từ khóa không hợp lệ" })
  @MaxLength(SEARCH_QUERY_MAX_LENGTH, { message: "Từ khóa dài quá 100 ký tự" })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Thể loại không hợp lệ" })
  @Min(1, { message: "Thể loại không hợp lệ" })
  genre?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Quốc gia không hợp lệ" })
  @Min(1, { message: "Quốc gia không hợp lệ" })
  country?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Năm phát hành không hợp lệ" })
  @Min(YEAR_MIN, { message: "Năm phát hành không hợp lệ" })
  @Max(YEAR_MAX, { message: "Năm phát hành không hợp lệ" })
  releaseYear?: number;

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
