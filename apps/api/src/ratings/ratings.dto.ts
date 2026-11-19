import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class RateMovieDto {
  @Type(() => Number)
  @IsInt({ message: "Điểm không hợp lệ" })
  @Min(1, { message: "Điểm từ 1 đến 5" })
  @Max(5, { message: "Điểm từ 1 đến 5" })
  score!: number;
}
