import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { assertMediaDirWritable, parseEnv } from "./env.schema";

const SECRET = "x".repeat(32);

function validEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    NODE_ENV: "development",
    WEB_ORIGIN: "http://localhost:3000",
    DATABASE_URL: "postgresql://movie:movie@localhost:5432/movie_platform",
    REDIS_URL: "redis://localhost:6379",
    JWT_SECRET: SECRET,
    MAIL_FROM: "FilmGenZ <no-reply@filmgenz.local>",
    ...overrides,
  };
}

describe("parseEnv", () => {
  it("applies safe defaults and strips an inline comment", () => {
    const env = parseEnv(
      validEnv({
        VIDEO_PROVIDER: "fake    # fake | cloudflare",
        COOKIE_SECURE: "",
        PLAYBACK_TOKEN_TTL_SEC: "",
        MAIL_FROM: '"FilmGenZ <no-reply@filmgenz.local>"',
      }),
    );
    expect(env.VIDEO_PROVIDER).toBe("fake");
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.PLAYBACK_TOKEN_TTL_SEC).toBe(7200);
    expect(env.API_PORT).toBe(4000);
    expect(env.TZ_APP).toBe("Asia/Ho_Chi_Minh");
    expect(env.MEDIA_DIR).toBe("./uploads");
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
  });

  it("accepts the longest playback token and a trailing slash on the origin", () => {
    const env = parseEnv(
      validEnv({ PLAYBACK_TOKEN_TTL_SEC: "86400", WEB_ORIGIN: "http://localhost:3000/" }),
    );
    expect(env.PLAYBACK_TOKEN_TTL_SEC).toBe(86400);
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
  });

  it("stops when JWT_SECRET is missing or short, without echoing the value", () => {
    const short = "short-secret-value";
    expect(() => parseEnv(validEnv({ JWT_SECRET: short }))).toThrow(
      "Thiếu JWT_SECRET hoặc chuỗi ngắn hơn 32 ký tự.",
    );
    expect(() => parseEnv(validEnv({ JWT_SECRET: "" }))).toThrow(/JWT_SECRET/);
    try {
      parseEnv(validEnv({ JWT_SECRET: short }));
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(short);
    }
  });

  it("rejects a playback token longer than one day", () => {
    expect(() => parseEnv(validEnv({ PLAYBACK_TOKEN_TTL_SEC: "86401" }))).toThrow(
      "PLAYBACK_TOKEN_TTL_SEC phải là số nguyên từ 1 đến 86400.",
    );
  });

  it("names the missing Cloudflare keys and does not print the ones that are set", () => {
    const token = "super-secret-token";
    expect(() =>
      parseEnv(
        validEnv({
          VIDEO_PROVIDER: "cloudflare",
          CF_STREAM_API_TOKEN: token,
        }),
      ),
    ).toThrow(/CF_ACCOUNT_ID/);
    try {
      parseEnv(validEnv({ VIDEO_PROVIDER: "cloudflare", CF_STREAM_API_TOKEN: token }));
    } catch (error) {
      expect((error as Error).message).not.toContain(token);
    }
  });

  it("accepts cloudflare when every key is present", () => {
    const env = parseEnv(
      validEnv({
        VIDEO_PROVIDER: "cloudflare",
        CF_ACCOUNT_ID: "acc",
        CF_STREAM_API_TOKEN: "tok",
        CF_STREAM_CUSTOMER_CODE: "cus",
        CF_STREAM_KEY_ID: "kid",
        CF_STREAM_KEY_JWK: "jwk",
      }),
    );
    expect(env.VIDEO_PROVIDER).toBe("cloudflare");
  });

  it("refuses an unsafe production setup and names each problem", () => {
    const password = "smtp-secret-value";
    expect(() =>
      parseEnv(
        validEnv({
          NODE_ENV: "production",
          COOKIE_SECURE: "false",
          VIDEO_PROVIDER: "fake",
          SMTP_HOST: "localhost",
          SMTP_PASS: password,
        }),
      ),
    ).toThrow(
      "NODE_ENV=production không cho phép COOKIE_SECURE=false, VIDEO_PROVIDER=fake, SMTP_HOST=localhost.",
    );
    try {
      parseEnv(validEnv({ NODE_ENV: "production", SMTP_HOST: "127.0.0.1", SMTP_PASS: password }));
    } catch (error) {
      expect((error as Error).message).toContain("SMTP_HOST=localhost");
      expect((error as Error).message).not.toContain(password);
    }
  });

  it("accepts a production setup that does not point at the local machine", () => {
    const env = parseEnv(
      validEnv({
        NODE_ENV: "production",
        COOKIE_SECURE: "true",
        VIDEO_PROVIDER: "cloudflare",
        SMTP_HOST: "smtp.example.com",
        CF_ACCOUNT_ID: "acc",
        CF_STREAM_API_TOKEN: "tok",
        CF_STREAM_CUSTOMER_CODE: "cus",
        CF_STREAM_KEY_ID: "kid",
        CF_STREAM_KEY_JWK: "jwk",
      }),
    );
    expect(env.NODE_ENV).toBe("production");
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it("does not echo an invalid value", () => {
    const bad = "cloud-secret";
    expect(() => parseEnv(validEnv({ VIDEO_PROVIDER: bad }))).toThrow(/VIDEO_PROVIDER/);
    try {
      parseEnv(validEnv({ VIDEO_PROVIDER: bad }));
    } catch (error) {
      expect((error as Error).message).not.toContain(bad);
    }
  });
});

describe("assertMediaDirWritable", () => {
  it("accepts a directory that can be created", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "filmgenz-media-"));
    try {
      expect(() => assertMediaDirWritable(path.join(dir, "uploads"))).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops when the path cannot be a directory", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "filmgenz-media-"));
    const file = path.join(dir, "not-a-dir");
    writeFileSync(file, "x");
    try {
      expect(() => assertMediaDirWritable(path.join(file, "child"))).toThrow(/MEDIA_DIR/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
