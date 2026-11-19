import { mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { z } from "zod";

// Thông báo chỉ nêu tên biến. Giá trị (khóa, mật khẩu, URL có user) không được in ra.
const CF_KEYS = [
  "CF_ACCOUNT_ID",
  "CF_STREAM_API_TOKEN",
  "CF_STREAM_CUSTOMER_CODE",
  "CF_STREAM_KEY_ID",
  "CF_STREAM_KEY_JWK",
] as const;

const optionalText = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? "development" : value),
    z.enum(["development", "test", "production"]),
  ),
  WEB_ORIGIN: z.string().trim().min(1),
  API_PORT: boundedInt(4000, 1, 65535),
  TZ_APP: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? "Asia/Ho_Chi_Minh" : value),
    z.string().trim().min(1),
  ),
  MEDIA_DIR: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? "./uploads" : value),
    z.string().trim().min(1),
  ),
  DATABASE_URL: z.string().trim().min(1),
  DATABASE_URL_TEST: optionalText,
  REDIS_URL: z.string().trim().min(1),
  JWT_SECRET: z.string().min(32),
  SESSION_TTL_DAYS: boundedInt(7, 1, 3660),
  COOKIE_SECURE: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return true;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
  }, z.boolean()),
  VIDEO_PROVIDER: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? "fake" : value),
    z.enum(["fake", "cloudflare"]),
  ),
  PLAYBACK_TOKEN_TTL_SEC: boundedInt(7200, 1, 86400),
  FAKE_HLS_URL: optionalText,
  CF_ACCOUNT_ID: optionalText,
  CF_STREAM_API_TOKEN: optionalText,
  CF_STREAM_CUSTOMER_CODE: optionalText,
  CF_STREAM_KEY_ID: optionalText,
  CF_STREAM_KEY_JWK: optionalText,
  SMTP_HOST: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? "localhost" : value),
    z.string().trim().min(1),
  ),
  SMTP_PORT: boundedInt(1025, 1, 65535),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  MAIL_FROM: z.string().trim().min(1),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): ApiEnv {
  const parsed = envSchema.safeParse(cleanEnv(raw));
  if (!parsed.success) {
    throw new Error(envErrorMessage(parsed.error.issues));
  }
  const env: ApiEnv = { ...parsed.data, WEB_ORIGIN: normalizeOrigin(parsed.data.WEB_ORIGIN) };
  assertRuntimeRules(env);
  return env;
}

export function assertMediaDirWritable(dir: string): void {
  const root = path.resolve(dir);
  const probe = path.join(root, `.write-probe-${process.pid}`);
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
  } catch {
    throw new Error(`MEDIA_DIR không tạo được hoặc không ghi được: ${root}`);
  }
}

function boundedInt(fallback: number, min: number, max: number) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return fallback;
    return value;
  }, z.coerce.number().int().min(min).max(max));
}

function cleanEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    cleaned[key] = typeof value === "string" ? stripInlineComment(value) : value;
  }
  return cleaned;
}

// File mẫu ghi chú sau dấu # trên cùng một dòng. Phải cắt trước khi so với enum.
function stripInlineComment(value: string): string {
  const trimmed = value.trim();
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2);
  const body = quoted ? trimmed.slice(1, -1) : trimmed;
  const hashAt = body.search(/\s#/);
  return (hashAt === -1 ? body : body.slice(0, hashAt)).trim();
}

function envErrorMessage(issues: { path: PropertyKey[] }[]): string {
  const fields = new Set(issues.map((issue) => String(issue.path[0] ?? "env")));
  if (fields.has("JWT_SECRET")) return "Thiếu JWT_SECRET hoặc chuỗi ngắn hơn 32 ký tự.";
  if (fields.has("PLAYBACK_TOKEN_TTL_SEC")) {
    return "PLAYBACK_TOKEN_TTL_SEC phải là số nguyên từ 1 đến 86400.";
  }
  return `Biến môi trường không hợp lệ: ${[...fields].join(", ")}.`;
}

function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("WEB_ORIGIN phải là URL http hoặc https.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("WEB_ORIGIN phải là URL http hoặc https.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("WEB_ORIGIN chỉ gồm scheme, máy chủ và cổng.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("WEB_ORIGIN không gồm đường dẫn.");
  }
  return url.origin;
}

function assertRuntimeRules(env: ApiEnv): void {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: env.TZ_APP });
  } catch {
    throw new Error("TZ_APP không phải múi giờ hợp lệ.");
  }
  if (env.FAKE_HLS_URL) assertHttpUrl(env.FAKE_HLS_URL, "FAKE_HLS_URL");
  if (env.VIDEO_PROVIDER === "cloudflare") {
    const missing = CF_KEYS.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`VIDEO_PROVIDER=cloudflare thiếu biến: ${missing.join(", ")}.`);
    }
  }
  if (env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  if (!env.COOKIE_SECURE) problems.push("COOKIE_SECURE=false");
  if (env.VIDEO_PROVIDER === "fake") problems.push("VIDEO_PROVIDER=fake");
  if (isLocalHost(env.SMTP_HOST)) problems.push("SMTP_HOST=localhost");
  if (problems.length > 0) {
    throw new Error(`NODE_ENV=production không cho phép ${problems.join(", ")}.`);
  }
}

function assertHttpUrl(value: string, name: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} phải là URL http hoặc https.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} phải là URL http hoặc https.`);
  }
}

function isLocalHost(host: string): boolean {
  const name = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return name === "localhost" || name === "127.0.0.1" || name === "::1";
}
