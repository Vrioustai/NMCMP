import { createPrivateKey, type JsonWebKey as CryptoJwk, type KeyObject } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { AppError } from "../common/app-error";
import {
  assertPlaybackTtl,
  type DirectUpload,
  type PlaybackLink,
  type UploadRequest,
  type VideoDetails,
  type VideoProvider,
} from "./video-provider";

const GENERAL_TIMEOUT_MS = 5_000;
const COPY_TIMEOUT_MS = 30_000;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type CloudflareConfig = {
  accountId: string;
  apiToken: string;
  customerCode: string;
  keyId: string;
  keyJwk: string;
  now?: () => Date;
  fetch?: FetchLike;
};

// Khóa ký đọc một lần lúc khởi động. Lệnh phát chỉ ký tại máy chủ, không gọi Cloudflare.
export class CloudflareStreamProvider implements VideoProvider {
  private readonly endpoint: string;
  private readonly apiToken: string;
  private readonly customerCode: string;
  private readonly keyId: string;
  private readonly privateKey: KeyObject;
  private readonly jwt = new JwtService();
  private readonly now: () => Date;
  private readonly fetchImpl: FetchLike;

  constructor(config: CloudflareConfig) {
    const account = encodeURIComponent(config.accountId);
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/stream`;
    this.apiToken = config.apiToken;
    this.customerCode = config.customerCode;
    this.keyId = config.keyId;
    this.privateKey = signingKey(config.keyJwk);
    this.now = config.now ?? (() => new Date());
    this.fetchImpl = config.fetch ?? fetch;
  }

  async createPlaybackUrl(streamUid: string, ttlSec: number): Promise<PlaybackLink> {
    assertPlaybackTtl(ttlSec);
    const exp = Math.floor(this.now().getTime() / 1000) + ttlSec;
    const token = this.jwt.sign(
      { sub: streamUid, kid: this.keyId, exp },
      {
        algorithm: "RS256",
        privateKey: this.privateKey,
        keyid: this.keyId,
        noTimestamp: true,
      },
    );
    const hlsUrl = `https://customer-${this.customerCode}.cloudflarestream.com/${token}/manifest/video.m3u8`;
    return { hlsUrl, expiresAt: new Date(exp * 1_000) };
  }

  async getVideo(streamUid: string): Promise<VideoDetails> {
    const result = await this.request(`/${encodeURIComponent(streamUid)}`, GENERAL_TIMEOUT_MS);
    return {
      uid: textField(result.uid) ?? streamUid,
      durationSec: durationOf(result.duration),
      requireSignedURLs: result.requireSignedURLs === true,
      ready: result.readyToStream === true,
    };
  }

  async createDirectUpload(request: UploadRequest): Promise<DirectUpload> {
    const result = await this.request("/direct_upload", GENERAL_TIMEOUT_MS, {
      maxDurationSeconds: request.maxDurationSeconds,
      requireSignedURLs: true,
      meta: { name: request.metaName },
    });
    const uid = textField(result.uid);
    const uploadUrl = textField(result.uploadURL);
    if (!uid || !uploadUrl) throw new AppError("VIDEO_PROVIDER_ERROR");
    return { uid, uploadUrl };
  }

  // Cloudflare tự tải file nên lệnh copy chờ 30 giây. Các lệnh còn lại chờ 5 giây.
  async copyFromUrl(url: string, metaName: string): Promise<{ uid: string }> {
    const result = await this.request("/copy", COPY_TIMEOUT_MS, {
      url,
      requireSignedURLs: true,
      meta: { name: metaName },
    });
    const uid = textField(result.uid);
    if (!uid) throw new AppError("VIDEO_PROVIDER_ERROR");
    return { uid };
  }

  async enableSignedUrls(streamUid: string): Promise<void> {
    await this.request(`/${encodeURIComponent(streamUid)}`, GENERAL_TIMEOUT_MS, {
      requireSignedURLs: true,
    });
  }

  private async request(
    path: string,
    timeoutMs: number,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.endpoint}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${this.apiToken}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      if (!response.ok) throw new Error("status");
      return readResult(await response.json());
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("VIDEO_PROVIDER_ERROR");
    }
  }
}

function signingKey(encoded: string): KeyObject {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error("shape");
    return createPrivateKey({ key: parsed as CryptoJwk, format: "jwk" });
  } catch {
    throw new Error("CF_STREAM_KEY_JWK không đọc được.");
  }
}

function readResult(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") throw new AppError("VIDEO_PROVIDER_ERROR");
  const body = payload as { success?: unknown; result?: unknown };
  if (body.success !== true || !body.result || typeof body.result !== "object") {
    throw new AppError("VIDEO_PROVIDER_ERROR");
  }
  return body.result as Record<string, unknown>;
}

function textField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function durationOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
