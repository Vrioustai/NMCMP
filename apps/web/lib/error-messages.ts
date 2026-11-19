export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "ACCOUNT_LOCKED",
  "FORBIDDEN",
  "AGE_RESTRICTED",
  "NOT_FOUND",
  "EMAIL_TAKEN",
  "SLUG_TAKEN",
  "GENRE_TAKEN",
  "GENRE_IN_USE",
  "WORD_TAKEN",
  "ALREADY_REPORTED",
  "RESET_TOKEN_INVALID",
  "PUBLISH_REQUIREMENTS_NOT_MET",
  "CANNOT_LOCK_ADMIN",
  "VIDEO_PROVIDER_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const FALLBACK = "Có lỗi xảy ra, vui lòng thử lại.";

const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "Một số thông tin chưa đúng. Hãy kiểm tra các ô được báo.",
  UNAUTHENTICATED: "Bạn cần đăng nhập để tiếp tục.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  ACCOUNT_LOCKED: "Tài khoản đã bị khóa.",
  FORBIDDEN: "Bạn không có quyền thực hiện việc này.",
  AGE_RESTRICTED: "Bạn chưa đủ tuổi để xem phim này.",
  NOT_FOUND: "Không tìm thấy nội dung này.",
  EMAIL_TAKEN: "Email này đã được dùng.",
  SLUG_TAKEN: "Đường dẫn này đã được dùng.",
  GENRE_TAKEN: "Tên thể loại này đã có.",
  GENRE_IN_USE: "Thể loại đang được dùng, chưa xóa được.",
  WORD_TAKEN: "Từ này đã có trong danh sách.",
  ALREADY_REPORTED: "Bạn đã báo cáo nội dung này.",
  RESET_TOKEN_INVALID: "Liên kết đặt lại mật khẩu không còn dùng được.",
  PUBLISH_REQUIREMENTS_NOT_MET: "Phim chưa đủ điều kiện để công khai.",
  CANNOT_LOCK_ADMIN: "Không khóa được tài khoản quản trị.",
  VIDEO_PROVIDER_ERROR: "Dịch vụ video không trả lời. Hãy thử lại.",
};

export function errorMessage(code: string | undefined): string {
  if (code && Object.prototype.hasOwnProperty.call(MESSAGES, code)) {
    return MESSAGES[code as ErrorCode];
  }
  return FALLBACK;
}
