import { randomBytes } from "crypto";
import { IMAGE_MAX_BYTES, SUBTITLE_MAX_BYTES } from "@movie/contracts";
import { Injectable, Logger } from "@nestjs/common";
import sharp from "sharp";
import { AppError } from "../common/app-error";
import { mediaRelative, MediaStorage } from "../media/media-storage";
import { PrismaService } from "../prisma/prisma.service";

const POSTER_WIDTH = 600;
const BACKDROP_WIDTH = 1_920;
export const SUBTITLE_LANGUAGE = "vi";

export type UploadedFile = { buffer: Buffer; size: number };

@Injectable()
export class AdminAssetsService {
  private readonly logger = new Logger(AdminAssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  async saveImage(
    movieId: number,
    kind: string,
    file: UploadedFile | undefined,
  ): Promise<{ posterUrl: string | null; backdropUrl: string | null }> {
    if (kind !== "poster" && kind !== "backdrop") {
      throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
        { field: "kind", message: "Loại ảnh không hợp lệ" },
      ]);
    }
    const bytes = requiredBytes(file, IMAGE_MAX_BYTES);
    if (!imageKind(bytes)) {
      throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
        { field: "file", message: "Ảnh phải là JPG, PNG hoặc WebP" },
      ]);
    }
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
      select: { id: true, slug: true, posterUrl: true, backdropUrl: true },
    });
    if (!movie) throw new AppError("NOT_FOUND");
    const webp = await toWebp(bytes, kind === "poster" ? POSTER_WIDTH : BACKDROP_WIDTH);
    const relative = `${kind}s/${movie.slug}-${randomBytes(4).toString("hex")}.webp`;
    await this.storage.save(relative, webp);
    const field = kind === "poster" ? "posterUrl" : "backdropUrl";
    const previous = movie[field];
    try {
      await this.prisma.movie.update({
        where: { id: movieId },
        data: { [field]: `/media/${relative}` },
      });
    } catch (error) {
      await this.storage.remove(relative).catch(() => undefined);
      throw error;
    }
    await this.removeQuiet(mediaRelative(previous), movieId);
    return {
      posterUrl: field === "posterUrl" ? `/media/${relative}` : movie.posterUrl,
      backdropUrl: field === "backdropUrl" ? `/media/${relative}` : movie.backdropUrl,
    };
  }

  async saveSubtitle(
    episodeId: number,
    language: string,
    file: UploadedFile | undefined,
  ): Promise<{ language: string; url: string }> {
    if (language !== SUBTITLE_LANGUAGE) {
      throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
        { field: "language", message: "Chỉ nhận phụ đề tiếng Việt" },
      ]);
    }
    const bytes = requiredBytes(file, SUBTITLE_MAX_BYTES);
    const text = decodeSubtitle(bytes);
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        movie: { select: { slug: true } },
        subtitles: { select: { url: true, language: true } },
      },
    });
    if (!episode) throw new AppError("NOT_FOUND");
    const relative = `subtitles/${episode.movie.slug}/s${episode.seasonNumber}e${episode.number}.${language}.vtt`;
    await this.storage.save(relative, Buffer.from(text, "utf8"));
    const url = `/media/${relative}`;
    const previous = episode.subtitles.find((subtitle) => subtitle.language === language)?.url;
    await this.prisma.subtitle.upsert({
      where: { episodeId_language: { episodeId, language } },
      create: { episodeId, language, url },
      update: { url },
    });
    if (previous && previous !== url) await this.removeQuiet(mediaRelative(previous), episodeId);
    return { language, url };
  }

  async removeSubtitle(episodeId: number, language: string): Promise<void> {
    if (language !== SUBTITLE_LANGUAGE) throw new AppError("NOT_FOUND");
    const subtitle = await this.prisma.subtitle.findUnique({
      where: { episodeId_language: { episodeId, language } },
    });
    if (!subtitle) throw new AppError("NOT_FOUND");
    await this.prisma.subtitle.delete({ where: { id: subtitle.id } });
    await this.removeQuiet(mediaRelative(subtitle.url), episodeId);
  }

  private async removeQuiet(relative: string | null, ownerId: number): Promise<void> {
    if (!relative) return;
    try {
      await this.storage.remove(relative);
    } catch {
      this.logger.warn(`Không xóa được file media của ${ownerId}.`);
    }
  }
}

function requiredBytes(file: UploadedFile | undefined, maxBytes: number): Buffer {
  if (!file?.buffer?.length) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "file", message: "Thiếu tệp" },
    ]);
  }
  if (file.buffer.length > maxBytes) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "file", message: "Tệp quá lớn" },
    ]);
  }
  return file.buffer;
}

function imageKind(bytes: Buffer): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length >= png.length && bytes.subarray(0, png.length).equals(png)) return "png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

async function toWebp(bytes: Buffer, width: number): Promise<Buffer> {
  try {
    return await sharp(bytes, { failOn: "error" }).rotate().resize({ width }).webp().toBuffer();
  } catch {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "file", message: "Ảnh không đọc được" },
    ]);
  }
}

function decodeSubtitle(bytes: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "file", message: "Phụ đề phải là UTF-8" },
    ]);
  }
  const first =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/, 1)[0]
      ?.trim() ?? "";
  if (!/^WEBVTT($|\s)/.test(first)) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "file", message: "Dòng đầu phải là WEBVTT" },
    ]);
  }
  return text.replace(/^\uFEFF/, "");
}
