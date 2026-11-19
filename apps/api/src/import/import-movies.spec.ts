import { VIDEO_DIRECT_UPLOAD_MAX_BYTES } from "@movie/contracts";
import { exceedsDirectUpload, rejectedVideoUrl } from "./import-movies";

describe("import video rules", () => {
  it("blocks a file over 200 MB unless a direct https link is used later", () => {
    expect(exceedsDirectUpload(VIDEO_DIRECT_UPLOAD_MAX_BYTES)).toBe(false);
    expect(exceedsDirectUpload(VIDEO_DIRECT_UPLOAD_MAX_BYTES + 1)).toBe(true);
  });

  it("rejects http and Google Drive links", () => {
    expect(rejectedVideoUrl("http://cdn.example/a.mp4")).toMatch(/https/);
    expect(rejectedVideoUrl("https://drive.google.com/file/d/abc")).toMatch(/Drive/);
    expect(rejectedVideoUrl("https://docs.google.com/uc?id=abc")).toMatch(/Drive/);
    expect(rejectedVideoUrl("https://cdn.example/a.mp4")).toBeNull();
  });
});
