import { AppError } from "../common/app-error";
import {
  assertPlaybackTtl,
  type DirectUpload,
  type PlaybackLink,
  type UploadRequest,
  type VideoDetails,
  type VideoProvider,
} from "./video-provider";

export const SLOW_MANIFEST_DELAY_MS = 4_000;
export const BROKEN_HLS_URL = "https://filmgenz.invalid/missing.m3u8";

// Playlist ngắn, không trỏ tới file thật. Trình phát hết hạn chờ thì coi là lỗi mạng.
export const FAKE_MANIFEST = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:1",
  "#EXTINF:1,",
  "https://filmgenz.invalid/segment.ts",
  "#EXT-X-ENDLIST",
  "",
].join("\n");

export type FakeVideoConfig = {
  fakeHlsUrl: string;
  webOrigin: string;
  now?: () => Date;
};

// Chế độ nằm trong uid vì lệnh phát chỉ nhận uid, không nhận cờ riêng.
export class FakeVideoProvider implements VideoProvider {
  private readonly fakeHlsUrl: string;
  private readonly webOrigin: string;
  private readonly now: () => Date;
  private readonly signed = new Set<string>();

  constructor(config: FakeVideoConfig) {
    this.fakeHlsUrl = config.fakeHlsUrl;
    this.webOrigin = config.webOrigin.replace(/\/$/, "");
    this.now = config.now ?? (() => new Date());
  }

  async createPlaybackUrl(streamUid: string, ttlSec: number): Promise<PlaybackLink> {
    assertPlaybackTtl(ttlSec);
    const mode = playbackMode(streamUid);
    if (mode === "error") {
      return { hlsUrl: BROKEN_HLS_URL, expiresAt: this.expiry(ttlSec) };
    }
    if (mode === "slow") {
      return {
        hlsUrl: `${this.webOrigin}/api/video/fake-manifest?slow=1`,
        expiresAt: this.expiry(ttlSec),
      };
    }
    if (!this.fakeHlsUrl) throw new Error("FAKE_HLS_URL chưa được đặt.");
    if (mode === "expired") {
      return { hlsUrl: this.fakeHlsUrl, expiresAt: new Date(this.now().getTime() - 1_000) };
    }
    return { hlsUrl: this.fakeHlsUrl, expiresAt: this.expiry(ttlSec) };
  }

  // Chế độ local không gọi Cloudflare. `unsigned:` giả video chưa bật chữ ký. `error:` giả lỗi.
  async getVideo(streamUid: string): Promise<VideoDetails> {
    if (streamUid === "error" || streamUid.startsWith("error:")) {
      throw new AppError("VIDEO_PROVIDER_ERROR");
    }
    const unsigned = streamUid === "unsigned" || streamUid.startsWith("unsigned:");
    const pending = streamUid === "pending" || streamUid.startsWith("pending:");
    return {
      uid: streamUid,
      durationSec: pending ? null : 90,
      requireSignedURLs: !unsigned || this.signed.has(streamUid),
      ready: !pending,
    };
  }

  async enableSignedUrls(streamUid: string): Promise<void> {
    this.signed.add(streamUid);
  }

  async createDirectUpload(request: UploadRequest): Promise<DirectUpload> {
    return {
      uid: `fake-upload-${request.metaName}`,
      uploadUrl: "https://filmgenz.invalid/upload",
    };
  }

  async copyFromUrl(_url: string, metaName: string): Promise<{ uid: string }> {
    return { uid: `fake-copy-${metaName}` };
  }

  private expiry(ttlSec: number): Date {
    return new Date(this.now().getTime() + ttlSec * 1_000);
  }
}

function playbackMode(streamUid: string): "ok" | "error" | "slow" | "expired" {
  if (streamUid === "error" || streamUid.startsWith("error:")) return "error";
  if (streamUid === "slow" || streamUid.startsWith("slow:")) return "slow";
  if (streamUid === "expired" || streamUid.startsWith("expired:")) return "expired";
  return "ok";
}
