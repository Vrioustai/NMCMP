import {
  AGE_RATINGS,
  MOVIE_STATUSES,
  MOVIE_TYPES,
  PAGE_SIZE_MAX,
  RESERVED_SLUGS,
  SEARCH_QUERY_MAX_LENGTH,
  SLUG_PATTERN,
  type AgeRating,
  type MovieStatus,
  type MovieType,
} from "@movie/contracts";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
  ValidateIf,
} from "class-validator";

const TITLE_MAX = 200;
const TEXT_MAX = 4_000;
const NAME_MAX = 80;
const SLUG_MAX = 80;
const URL_MAX = 2_000;
const LICENSE_MAX = 500;
const LIST_MAX = 20;
const YEAR_MIN = 1888;
const YEAR_MAX = 2100;
const URL_OPTIONS = { protocols: ["http", "https"], require_protocol: true };

function trimmed(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function trimmedNames(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => (typeof item === "string" ? item.trim() : item));
}

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  return text === "" ? undefined : text;
}

function allowedSlug(value: unknown): boolean {
  return typeof value === "string" && !(RESERVED_SLUGS as readonly string[]).includes(value);
}

function IsGenreIds(): PropertyDecorator {
  return (target, propertyKey) => {
    ArrayMinSize(1, { message: "Cần ít nhất một thể loại" })(target, propertyKey);
    ArrayMaxSize(LIST_MAX, { message: "Danh sách thể loại quá dài" })(target, propertyKey);
    ArrayUnique({ message: "Thể loại bị lặp" })(target, propertyKey);
    IsInt({ each: true, message: "Thể loại không hợp lệ" })(target, propertyKey);
    Min(1, { each: true, message: "Thể loại không hợp lệ" })(target, propertyKey);
  };
}

function IsNameList(): PropertyDecorator {
  return (target, propertyKey) => {
    ArrayMaxSize(LIST_MAX, { message: "Danh sách quá dài" })(target, propertyKey);
    ArrayUnique({ message: "Tên bị lặp" })(target, propertyKey);
    IsString({ each: true, message: "Tên không hợp lệ" })(target, propertyKey);
    MinLength(1, { each: true, message: "Tên không hợp lệ" })(target, propertyKey);
    MaxLength(NAME_MAX, { each: true, message: "Tên dài quá 80 ký tự" })(target, propertyKey);
  };
}

export class CreateMovieDto {
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tiêu đề không hợp lệ" })
  @MinLength(1, { message: "Thiếu tiêu đề" })
  @MaxLength(TITLE_MAX, { message: "Tiêu đề dài quá 200 ký tự" })
  title!: string;

  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Slug không hợp lệ" })
  @Matches(SLUG_PATTERN, { message: "Slug chỉ gồm chữ thường, số và dấu gạch ngang" })
  @MaxLength(SLUG_MAX, { message: "Slug dài quá 80 ký tự" })
  @ValidateBy({
    name: "reservedSlug",
    validator: { validate: allowedSlug, defaultMessage: () => "Slug không được dùng" },
  })
  slug!: string;

  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Mô tả không hợp lệ" })
  @MinLength(1, { message: "Thiếu mô tả" })
  @MaxLength(TEXT_MAX, { message: "Mô tả dài quá 4000 ký tự" })
  description!: string;

  @IsIn(MOVIE_TYPES, { message: "Loại phim không hợp lệ" })
  type!: MovieType;

  @IsInt({ message: "Năm phát hành không hợp lệ" })
  @Min(YEAR_MIN, { message: "Năm phát hành không hợp lệ" })
  @Max(YEAR_MAX, { message: "Năm phát hành không hợp lệ" })
  releaseYear!: number;

  @IsIn(AGE_RATINGS, { message: "Nhãn độ tuổi không hợp lệ" })
  ageRating!: AgeRating;

  @IsGenreIds()
  genreIds!: number[];

  @Transform(({ value }) => trimmed(value))
  @IsUrl(URL_OPTIONS, { message: "Nguồn phải là URL http hoặc https" })
  @MaxLength(URL_MAX, { message: "Nguồn dài quá 2000 ký tự" })
  sourceUrl!: string;

  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Giấy phép không hợp lệ" })
  @MinLength(1, { message: "Thiếu giấy phép" })
  @MaxLength(LICENSE_MAX, { message: "Giấy phép dài quá 500 ký tự" })
  license!: string;

  @IsOptional()
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tên gốc không hợp lệ" })
  @MinLength(1, { message: "Tên gốc không hợp lệ" })
  @MaxLength(TITLE_MAX, { message: "Tên gốc dài quá 200 ký tự" })
  originalTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimmed(value))
  @IsUrl(URL_OPTIONS, { message: "Trailer phải là URL http hoặc https" })
  @MaxLength(URL_MAX, { message: "Trailer dài quá 2000 ký tự" })
  trailerUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimmedNames(value))
  @IsNameList()
  countries?: string[];

  @IsOptional()
  @Transform(({ value }) => trimmedNames(value))
  @IsNameList()
  directors?: string[];

  @IsOptional()
  @Transform(({ value }) => trimmedNames(value))
  @IsNameList()
  actors?: string[];
}

// Không gửi trường thì giữ nguyên. null chỉ xóa tên gốc và trailer.
export class UpdateMovieDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tiêu đề không hợp lệ" })
  @MinLength(1, { message: "Thiếu tiêu đề" })
  @MaxLength(TITLE_MAX, { message: "Tiêu đề dài quá 200 ký tự" })
  title?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Slug không hợp lệ" })
  @Matches(SLUG_PATTERN, { message: "Slug chỉ gồm chữ thường, số và dấu gạch ngang" })
  @MaxLength(SLUG_MAX, { message: "Slug dài quá 80 ký tự" })
  @ValidateBy({
    name: "reservedSlug",
    validator: { validate: allowedSlug, defaultMessage: () => "Slug không được dùng" },
  })
  slug?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Mô tả không hợp lệ" })
  @MinLength(1, { message: "Thiếu mô tả" })
  @MaxLength(TEXT_MAX, { message: "Mô tả dài quá 4000 ký tự" })
  description?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(MOVIE_TYPES, { message: "Loại phim không hợp lệ" })
  type?: MovieType;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt({ message: "Năm phát hành không hợp lệ" })
  @Min(YEAR_MIN, { message: "Năm phát hành không hợp lệ" })
  @Max(YEAR_MAX, { message: "Năm phát hành không hợp lệ" })
  releaseYear?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(AGE_RATINGS, { message: "Nhãn độ tuổi không hợp lệ" })
  ageRating?: AgeRating;

  @ValidateIf((_, value) => value !== undefined)
  @IsGenreIds()
  genreIds?: number[];

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmed(value))
  @IsUrl(URL_OPTIONS, { message: "Nguồn phải là URL http hoặc https" })
  @MaxLength(URL_MAX, { message: "Nguồn dài quá 2000 ký tự" })
  sourceUrl?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Giấy phép không hợp lệ" })
  @MinLength(1, { message: "Thiếu giấy phép" })
  @MaxLength(LICENSE_MAX, { message: "Giấy phép dài quá 500 ký tự" })
  license?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: "Tên gốc không hợp lệ" })
  @MinLength(1, { message: "Tên gốc không hợp lệ" })
  @MaxLength(TITLE_MAX, { message: "Tên gốc dài quá 200 ký tự" })
  originalTitle?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Transform(({ value }) => trimmed(value))
  @IsUrl(URL_OPTIONS, { message: "Trailer phải là URL http hoặc https" })
  @MaxLength(URL_MAX, { message: "Trailer dài quá 2000 ký tự" })
  trailerUrl?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmedNames(value))
  @IsNameList()
  countries?: string[];

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmedNames(value))
  @IsNameList()
  directors?: string[];

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => trimmedNames(value))
  @IsNameList()
  actors?: string[];
}

export class MovieStatusDto {
  @IsIn(MOVIE_STATUSES, { message: "Trạng thái không hợp lệ" })
  status!: MovieStatus;
}

export class AdminMovieQueryDto {
  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsString({ message: "Từ khóa không hợp lệ" })
  @MaxLength(SEARCH_QUERY_MAX_LENGTH, { message: "Từ khóa dài quá 100 ký tự" })
  q?: string;

  @IsOptional()
  @Transform(({ value }) => blankToUndefined(value))
  @IsIn(MOVIE_STATUSES, { message: "Trạng thái không hợp lệ" })
  status?: MovieStatus;

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
