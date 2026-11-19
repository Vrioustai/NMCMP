import { createHash } from "crypto";
import argon2 from "argon2";

const HASH_OPTIONS = { type: argon2.argon2id } as const;

// Chuỗi này không phải mật khẩu của ai. Dùng để lần kiểm băm vẫn chạy khi email không có.
const TIMING_PAD = "timing-pad-not-a-user";

export function passwordVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 8);
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}

export function timingPadHash(): Promise<string> {
  return hashPassword(TIMING_PAD);
}
