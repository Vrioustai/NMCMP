import { VIDEO_DIRECT_UPLOAD_MAX_BYTES } from "@movie/contracts";

export function directUploadError(size: number): string | null {
  if (size > VIDEO_DIRECT_UPLOAD_MAX_BYTES) {
    return "File lớn hơn 200 MB. Hãy dán link https của video.";
  }
  return null;
}
