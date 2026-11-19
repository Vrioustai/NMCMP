export const PLAYBACK_TTL_MAX_SEC = 86_400;

export type PlaybackLink = {
  hlsUrl: string;
  expiresAt: Date;
};

export type VideoDetails = {
  uid: string;
  durationSec: number | null;
  requireSignedURLs: boolean;
  ready: boolean;
};

export type UploadRequest = {
  maxDurationSeconds: number;
  metaName: string;
};

export type DirectUpload = {
  uid: string;
  uploadUrl: string;
};

export interface VideoProvider {
  createPlaybackUrl(streamUid: string, ttlSec: number): Promise<PlaybackLink>;
  getVideo(streamUid: string): Promise<VideoDetails>;
  createDirectUpload(request: UploadRequest): Promise<DirectUpload>;
  copyFromUrl(url: string, metaName: string): Promise<{ uid: string }>;
  enableSignedUrls(streamUid: string): Promise<void>;
}

export const VIDEO_PROVIDER = Symbol("VIDEO_PROVIDER");

// Hạn ký không được quá 24 giờ. Thông báo chỉ nêu tên biến.
export function assertPlaybackTtl(ttlSec: number): void {
  if (!Number.isInteger(ttlSec) || ttlSec < 1 || ttlSec > PLAYBACK_TTL_MAX_SEC) {
    throw new Error("PLAYBACK_TOKEN_TTL_SEC không hợp lệ.");
  }
}
