import { PAGE_SIZE_MAX, type ModerationDecision } from "@movie/contracts";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

const DECISIONS = ["HIDE", "DELETE", "WARN", "REJECT"] as const;
const QUEUE = ["PENDING", "HANDLED"] as const;

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  return text === "" ? undefined : text;
}

export class AdminReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsIn(QUEUE, { message: "Trạng thái không hợp lệ" })
  status?: (typeof QUEUE)[number];

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

export class ReportDecisionDto {
  @IsIn(DECISIONS, { message: "Quyết định không hợp lệ" })
  decision!: ModerationDecision;
}
