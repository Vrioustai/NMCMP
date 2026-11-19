import { generateKeyPairSync } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { AppError } from "../common/app-error";
import { CloudflareStreamProvider } from "./cloudflare-stream.provider";

const TOKEN = "cf-token-test";
const KEY_ID = "key-test";

function material(): {
  encoded: string;
  publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"];
} {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = privateKey.export({ format: "jwk" });
  return { encoded: Buffer.from(JSON.stringify(jwk)).toString("base64"), publicKey };
}

function provider(fetchImpl: jest.Mock, encoded: string): CloudflareStreamProvider {
  return new CloudflareStreamProvider({
    accountId: "account",
    apiToken: TOKEN,
    customerCode: "customer",
    keyId: KEY_ID,
    keyJwk: encoded,
    fetch: fetchImpl,
  });
}

function ok(result: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, result }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("CloudflareStreamProvider", () => {
  const keys = material();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("TEST_UC07_08 signs kid and exp and verifies with the public key", async () => {
    const fetchImpl = jest.fn();
    const video = provider(fetchImpl, keys.encoded);
    const before = Math.floor(Date.now() / 1000);
    const link = await video.createPlaybackUrl("stream-1", 60);
    const token = new URL(link.hlsUrl).pathname.split("/")[1];
    const [headerPart, payloadPart] = token.split(".");
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as {
      alg: string;
      kid: string;
    };
    const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
      sub: string;
      kid: string;
      exp: number;
    };

    expect(link.hlsUrl.startsWith("https://customer-customer.cloudflarestream.com/")).toBe(true);
    expect(link.hlsUrl.endsWith("/manifest/video.m3u8")).toBe(true);
    expect(header.alg).toBe("RS256");
    expect(header.kid).toBe(KEY_ID);
    expect(claims.sub).toBe("stream-1");
    expect(claims.kid).toBe(KEY_ID);
    expect(claims.exp).toBe(Math.floor(link.expiresAt.getTime() / 1000));
    expect(claims.exp).toBeGreaterThanOrEqual(before + 60);
    expect(claims.exp).toBeLessThanOrEqual(before + 61);
    const publicPem = keys.publicKey.export({ type: "spki", format: "pem" });
    expect(() =>
      new JwtService().verify(token, {
        publicKey: typeof publicPem === "string" ? publicPem : publicPem.toString("utf8"),
        algorithms: ["RS256"],
      }),
    ).not.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a signing key that cannot be read without echoing it", () => {
    const secret = "SUPER-SECRET-JWK";
    expect(
      () =>
        new CloudflareStreamProvider({
          accountId: "account",
          apiToken: TOKEN,
          customerCode: "customer",
          keyId: KEY_ID,
          keyJwk: Buffer.from(secret).toString("base64"),
          fetch: jest.fn(),
        }),
    ).toThrow("CF_STREAM_KEY_JWK không đọc được.");
  });

  it("reads duration and the signed-url flag with a 5 second timeout", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        ok({ uid: "video-1", duration: 12.5, requireSignedURLs: true, readyToStream: false }),
      );
    const details = await provider(fetchImpl, keys.encoded).getVideo("video-1");
    expect(details).toEqual({
      uid: "video-1",
      durationSec: 12.5,
      requireSignedURLs: true,
      ready: false,
    });
    expect(timeout).toHaveBeenCalledWith(5_000);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account/stream/video-1",
    );
  });

  it("sends requireSignedURLs on direct upload and on copy", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(ok({ uid: "up-1", uploadURL: "https://upload.example/up-1" }))
      .mockResolvedValueOnce(ok({ uid: "copy-1" }));
    const video = provider(fetchImpl, keys.encoded);

    await expect(
      video.createDirectUpload({ maxDurationSeconds: 3600, metaName: "tap-1" }),
    ).resolves.toEqual({ uid: "up-1", uploadUrl: "https://upload.example/up-1" });
    await expect(video.copyFromUrl("https://example.com/a.mp4", "tap-1")).resolves.toEqual({
      uid: "copy-1",
    });

    const upload = JSON.parse(String(fetchImpl.mock.calls[0][1].body)) as {
      requireSignedURLs: boolean;
    };
    const copy = JSON.parse(String(fetchImpl.mock.calls[1][1].body)) as {
      requireSignedURLs: boolean;
      url: string;
    };
    expect(upload.requireSignedURLs).toBe(true);
    expect(copy.requireSignedURLs).toBe(true);
    expect(copy.url).toBe("https://example.com/a.mp4");
    expect(timeout).toHaveBeenNthCalledWith(1, 5_000);
    expect(timeout).toHaveBeenNthCalledWith(2, 30_000);
    expect(String(fetchImpl.mock.calls[0][1].headers.authorization)).toBe(`Bearer ${TOKEN}`);
  });

  it("turns signed urls on with a 5 second timeout", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    const fetchImpl = jest.fn().mockResolvedValue(ok({ uid: "video-1" }));
    await provider(fetchImpl, keys.encoded).enableSignedUrls("video-1");
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1].body)) as {
      requireSignedURLs: boolean;
    };
    expect(body.requireSignedURLs).toBe(true);
    expect(timeout).toHaveBeenCalledWith(5_000);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/stream/video-1");
  });

  it("turns Cloudflare failures into VIDEO_PROVIDER_ERROR", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response("no", { status: 500 }))
      .mockResolvedValueOnce(ok(null))
      .mockRejectedValueOnce(new Error("timed out"));
    const video = provider(fetchImpl, keys.encoded);

    await expect(video.getVideo("video-1")).rejects.toMatchObject({ code: "VIDEO_PROVIDER_ERROR" });
    await expect(video.getVideo("video-1")).rejects.toBeInstanceOf(AppError);
    await expect(video.copyFromUrl("https://example.com/a.mp4", "tap-1")).rejects.toMatchObject({
      code: "VIDEO_PROVIDER_ERROR",
    });
  });
});
