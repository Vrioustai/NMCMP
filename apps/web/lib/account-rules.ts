import {
  BIRTH_YEAR_MIN,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from "@movie/contracts";

export function currentYear(now = new Date()): number {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  })
    .formatToParts(now)
    .find((part) => part.type === "year")?.value;
  return Number(year);
}

export function emailError(value: string): string | undefined {
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email không hợp lệ";
  return undefined;
}

export function loginPasswordError(value: string): string | undefined {
  if (value.length < 1) return "Thiếu mật khẩu";
  if (value.length > PASSWORD_MAX_LENGTH) return "Mật khẩu dài quá 72 ký tự";
  return undefined;
}

export function passwordError(value: string): string | undefined {
  if (value.length < PASSWORD_MIN_LENGTH) return "Mật khẩu cần từ 8 ký tự";
  if (value.length > PASSWORD_MAX_LENGTH) return "Mật khẩu dài quá 72 ký tự";
  if (!PASSWORD_PATTERN.test(value)) return "Mật khẩu cần chữ hoa, chữ thường và chữ số";
  return undefined;
}

export function confirmPasswordError(password: string, confirm: string): string | undefined {
  if (confirm !== password) return "Mật khẩu nhập lại chưa khớp";
  return undefined;
}

export function displayNameError(value: string): string | undefined {
  const name = value.trim();
  if (name.length < DISPLAY_NAME_MIN_LENGTH) return "Tên hiển thị cần từ 2 ký tự";
  if (name.length > DISPLAY_NAME_MAX_LENGTH) return "Tên hiển thị dài quá 40 ký tự";
  return undefined;
}

export function birthYearError(value: string, year = currentYear()): string | undefined {
  if (!/^\d{4}$/.test(value.trim())) return "Năm sinh không hợp lệ";
  const birthYear = Number(value);
  if (birthYear < BIRTH_YEAR_MIN || birthYear > year) return "Năm sinh không hợp lệ";
  return undefined;
}
