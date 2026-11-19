import { createHash, randomBytes } from "crypto";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function createResetToken(): string {
  return randomBytes(32).toString("base64url");
}

// CSDL chỉ giữ hàm băm của đúng chuỗi trên liên kết, để lộ bảng cũng không dùng được mã.
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
