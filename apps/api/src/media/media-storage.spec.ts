import { mkdtempSync, rmSync } from "fs";
import { readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { MediaStorage } from "./media-storage";

describe("MediaStorage", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "filmgenz-files-"));
  const storage = new MediaStorage(dir);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("rejects paths that leave the media directory", () => {
    expect(storage.resolveRequestPath("/../.env")).toBeNull();
    expect(storage.resolveRequestPath("/%2e%2e/secret")).toBeNull();
    expect(storage.resolveRequestPath("/.env")).toBeNull();
    expect(storage.resolveRequestPath("/posters/a.webp")).toBe(path.join(dir, "posters", "a.webp"));
  });

  it("writes and deletes a file inside the directory", async () => {
    const relative = await storage.save("posters/a.webp", Buffer.from("img"));
    expect(relative).toBe("posters/a.webp");
    await expect(readFile(path.join(dir, "posters", "a.webp"), "utf8")).resolves.toBe("img");
    await storage.remove(relative);
    await expect(readFile(path.join(dir, "posters", "a.webp"))).rejects.toThrow();
  });

  it("refuses to save outside the directory", async () => {
    await expect(storage.save("../secret.txt", Buffer.from("no"))).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });
});
