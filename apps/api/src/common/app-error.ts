import { HttpException } from "@nestjs/common";

export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 403,
  FORBIDDEN: 403,
  AGE_RESTRICTED: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  SLUG_TAKEN: 409,
  GENRE_TAKEN: 409,
  GENRE_IN_USE: 409,
  WORD_TAKEN: 409,
  ALREADY_REPORTED: 409,
  RESET_TOKEN_INVALID: 410,
  PUBLISH_REQUIREMENTS_NOT_MET: 422,
  CANNOT_LOCK_ADMIN: 422,
  VIDEO_PROVIDER_ERROR: 502,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type FieldError = { field: string; message: string };

export type ErrorBody = {
  error: {
    code: ErrorCode | "INTERNAL";
    message: string;
    details?: FieldError[];
  };
};

const ERROR_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  UNAUTHENTICATED: "Chưa đăng nhập",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng",
  ACCOUNT_LOCKED: "Tài khoản đã bị khóa",
  FORBIDDEN: "Không có quyền thực hiện",
  AGE_RESTRICTED: "Bạn chưa đủ tuổi để xem phim này",
  NOT_FOUND: "Không tìm thấy",
  EMAIL_TAKEN: "Email đã được dùng",
  SLUG_TAKEN: "Slug đã được dùng",
  GENRE_TAKEN: "Tên thể loại đã được dùng",
  GENRE_IN_USE: "Thể loại đang được dùng",
  WORD_TAKEN: "Từ này đã có trong danh sách",
  ALREADY_REPORTED: "Bạn đã báo cáo nội dung này",
  RESET_TOKEN_INVALID: "Liên kết đặt lại mật khẩu không còn dùng được",
  PUBLISH_REQUIREMENTS_NOT_MET: "Phim chưa đủ điều kiện công khai",
  CANNOT_LOCK_ADMIN: "Không khóa được tài khoản quản trị",
  VIDEO_PROVIDER_ERROR: "Dịch vụ video không trả lời",
};

export const SERVER_ERROR_BODY: ErrorBody = {
  error: { code: "INTERNAL", message: "Có lỗi xảy ra, vui lòng thử lại" },
};

export class AppError extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string, details?: FieldError[]) {
    super(errorBody(code, message, details), ERROR_STATUS[code]);
    this.code = code;
  }
}

export function errorBody(code: ErrorCode, message?: string, details?: FieldError[]): ErrorBody {
  return {
    error: {
      code,
      message: message ?? ERROR_MESSAGE[code],
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
}

export function isErrorBody(value: unknown): value is ErrorBody {
  if (!value || typeof value !== "object") return false;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return typeof code === "string" && typeof message === "string";
}
