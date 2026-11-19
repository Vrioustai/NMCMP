import { REPORT_MAX_LENGTH } from "@movie/contracts";
import { Transform, Type } from "class-transformer";
import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateReportDto {
  @Type(() => Number)
  @IsInt({ message: "Bình luận không hợp lệ" })
  @Min(1, { message: "Bình luận không hợp lệ" })
  danmakuId!: number;

  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Lý do không hợp lệ" })
  @MinLength(1, { message: "Lý do cần từ 1 đến 200 ký tự" })
  @MaxLength(REPORT_MAX_LENGTH, { message: "Lý do cần từ 1 đến 200 ký tự" })
  reason!: string;
}
