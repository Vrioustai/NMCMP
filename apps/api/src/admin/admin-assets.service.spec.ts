import sharp from "sharp";
import { AppError } from "../common/app-error";
import { AdminAssetsService } from "./admin-assets.service";

function harness() {
  const prisma = {
    movie: {
      findUnique: jest.fn().mockResolvedValue({
        id: 4,
        slug: "phim",
        posterUrl: "/media/posters/phim-old.webp",
        backdropUrl: null,
      }),
      update: jest.fn(),
    },
    episode: {
      findUnique: jest.fn().mockResolvedValue({
        id: 8,
        seasonNumber: 1,
        number: 1,
        movie: { slug: "phim" },
        subtitles: [],
      }),
    },
    subtitle: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  };
  const storage = { save: jest.fn(), remove: jest.fn() };
  const service = new AdminAssetsService(prisma as never, storage as never);
  return { service, prisma, storage };
}

describe("AdminAssetsService", () => {
  it("rejects a text file even when the name says jpg", async () => {
    const { service, storage } = harness();
    await expect(
      service.saveImage(4, "poster", { buffer: Buffer.from("not-an-image"), size: 12 }),
    ).rejects.toBeInstanceOf(AppError);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("stores a png renamed as jpg as webp without exif", async () => {
    const png = await sharp({
      create: { width: 12, height: 18, channels: 3, background: { r: 20, g: 40, b: 60 } },
    })
      .png()
      .toBuffer();
    const { service, prisma, storage } = harness();
    const saved = await service.saveImage(4, "poster", { buffer: png, size: png.length });
    const written = storage.save.mock.calls[0][1] as Buffer;
    const meta = await sharp(written).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(600);
    expect(meta.exif).toBeUndefined();
    expect(saved.posterUrl).toMatch(/^\/media\/posters\/phim-[0-9a-f]{8}\.webp$/);
    expect(prisma.movie.update).toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledWith("posters/phim-old.webp");
  });

  it("rejects a subtitle whose first line is not WEBVTT and replaces the same path", async () => {
    const { service, storage, prisma } = harness();
    await expect(
      service.saveSubtitle(8, "vi", { buffer: Buffer.from("NOTE hello"), size: 10 }),
    ).rejects.toBeInstanceOf(AppError);

    const body = Buffer.from("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nXin chào\n");
    const first = await service.saveSubtitle(8, "vi", { buffer: body, size: body.length });
    const again = Buffer.from("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLần hai\n");
    const second = await service.saveSubtitle(8, "vi", { buffer: again, size: again.length });
    expect(first.url).toBe(second.url);
    expect(storage.save).toHaveBeenCalledTimes(2);
    expect(storage.save.mock.calls[0][0]).toBe(storage.save.mock.calls[1][0]);
    expect(prisma.subtitle.upsert).toHaveBeenCalledTimes(2);
  });
});
