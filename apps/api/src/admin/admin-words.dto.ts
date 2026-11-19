import { IsString, MaxLength } from "class-validator";

const WORD_MAX = 40;

export class CreateBannedWordDto {
  @IsString({ message: "Từ không hợp lệ" })
  @MaxLength(WORD_MAX, { message: "Từ dài quá 40 ký tự" })
  word!: string;
}
