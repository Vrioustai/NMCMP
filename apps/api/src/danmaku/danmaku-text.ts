import { DANMAKU_MAX_LENGTH } from "@movie/contracts";

// Đếm sau khi chuẩn hóa: một emoji là một ký tự, không phải hai byte.
export function normalizeDanmaku(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/\p{Cc}/gu, "")
    .trim();
}

export function danmakuLength(text: string): number {
  return Array.from(text).length;
}

export function exceedsDanmakuLength(text: string): boolean {
  return danmakuLength(text) > DANMAKU_MAX_LENGTH;
}

// "ngu" không được chặn "nguyên": chỉ khớp khi hai bên không còn chữ cái.
export function containsBannedWord(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => {
    const body = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<!\\p{L})${body}(?!\\p{L})`, "u").test(lower);
  });
}
