import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { StreamCopyDto } from "./admin-episodes.dto";

const options = { whitelist: true, forbidNonWhitelisted: true };

describe("StreamCopyDto", () => {
  it("accepts a public https file url", async () => {
    const dto = plainToInstance(StreamCopyDto, { url: " https://cdn.example/video.mp4 " });
    expect(await validate(dto, options)).toHaveLength(0);
    expect(dto.url).toBe("https://cdn.example/video.mp4");
  });

  it("rejects http and Google Drive links", async () => {
    const links = [
      "http://cdn.example/video.mp4",
      "https://drive.google.com/file/d/abc",
      "https://docs.google.com/uc?id=abc",
      "https://www.drive.google.com/file/d/abc",
    ];
    for (const url of links) {
      const dto = plainToInstance(StreamCopyDto, { url });
      expect((await validate(dto, options)).map((error) => error.property)).toContain("url");
    }
  });
});
