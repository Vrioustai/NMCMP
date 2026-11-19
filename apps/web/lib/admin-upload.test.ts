import { VIDEO_DIRECT_UPLOAD_MAX_BYTES } from "@movie/contracts";
import { directUploadError } from "./admin-upload";

describe("direct upload size", () => {
  it("blocks a file over 200 MB before any upload starts", () => {
    expect(directUploadError(VIDEO_DIRECT_UPLOAD_MAX_BYTES)).toBeNull();
    expect(directUploadError(VIDEO_DIRECT_UPLOAD_MAX_BYTES + 1)).toMatch(/200 MB/);
  });
});
