import { PAGE_SIZE_MAX } from "@movie/contracts";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

const PROGRESS_MAX_SEC = 60 * 60 * 24;

export class SaveProgressDto {
  @Type(() => Number)
  @IsInt({ message: "Tiến độ không hợp lệ" })
  @Min(0, { message: "Tiến độ không hợp lệ" })
  @Max(PROGRESS_MAX_SEC, { message: "Tiến độ không hợp lệ" })
  progressSec!: number;
}

export class HistoryQueryDto {
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
