import { COMMENT_MAX_LENGTH } from "@movie/contracts";
import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { PAGE_SIZE_MAX } from "../common/pagination";

export class CreateCommentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Bình luận không hợp lệ" })
  @MinLength(1, { message: "Bình luận cần từ 1 đến 1.000 ký tự" })
  @MaxLength(COMMENT_MAX_LENGTH, { message: "Bình luận cần từ 1 đến 1.000 ký tự" })
  content!: string;
}

export class CommentQueryDto {
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
