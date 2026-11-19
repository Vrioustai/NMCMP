import { AppError } from "../common/app-error";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function vietnamDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

export function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / DAY_MS) + 1;
}

export function statsRange(
  input: { from?: string; to?: string },
  now: Date,
): { from: string; to: string } {
  const today = vietnamDay(now);
  const from = input.from?.trim() || addDays(today, -6);
  const to = input.to?.trim() || today;
  if ((input.from && !input.to) || (!input.from && input.to)) {
    throw invalid("Chọn cả ngày bắt đầu và ngày kết thúc");
  }
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(`${from}T00:00:00Z`))) {
    throw invalid("Ngày không hợp lệ");
  }
  if (from > to) throw invalid("Ngày bắt đầu phải trước ngày kết thúc");
  if (inclusiveDays(from, to) > MAX_DAYS) throw invalid("Khoảng thời gian tối đa 90 ngày");
  return { from, to };
}

function invalid(message: string): AppError {
  return new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [{ field: "from", message }]);
}
