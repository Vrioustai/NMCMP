const SEGMENT_NAME = /^seg\d{3}\.ts$/;

export function hlsSegmentUrl(
  webOrigin: string,
  fileId: string,
  name: string,
  exp: string,
  sig: string,
): string {
  const origin = webOrigin.replace(/\/$/, "");
  const query = `exp=${encodeURIComponent(exp)}&sig=${encodeURIComponent(sig)}`;
  return `${origin}/api/video/hls/${encodeURIComponent(fileId)}/${name}?${query}`;
}

// Trả ngay một đoạn đầu để trình phát không chờ cả bộ phim được cắt xong.
export function placeholderPlaylist(segmentUrl: string): string {
  return ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:10", "#EXT-X-MEDIA-SEQUENCE:0", "#EXTINF:6.000,", segmentUrl, ""].join(
    "\n",
  );
}

// Bỏ dòng đang ghi dở, rồi đổi tên đoạn tương đối thành URL có chữ ký.
export function rewriteHlsPlaylist(
  body: string,
  segmentUrl: (name: string) => string,
): string | null {
  if (!body.startsWith("#EXTM3U")) return null;
  let text = body;
  if (!text.endsWith("\n")) {
    const cut = text.lastIndexOf("\n");
    if (cut < 0) return null;
    text = text.slice(0, cut + 1);
  }
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length > 0 && lines[lines.length - 1].startsWith("#EXTINF")) lines.pop();
  if (!lines.some((line) => SEGMENT_NAME.test(line.trim()))) return null;
  return `${lines
    .map((line) => {
      const name = line.trim();
      return SEGMENT_NAME.test(name) ? segmentUrl(name) : line;
    })
    .join("\n")}\n`;
}

export function isHlsSegmentName(name: string): boolean {
  return SEGMENT_NAME.test(name);
}
