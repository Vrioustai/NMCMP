import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { runImport, type ImportResult } from "../src/import/import-movies";
import { MediaStorage } from "../src/media/media-storage";
import type { VideoProvider } from "../src/video/video-provider";

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) throw new Error("Thiếu DATABASE_URL_TEST.");

describe("Import movies", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  let root = "";

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "filmgenz-import-"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  it("TEST_NFR15 skips a movie that lacks source or license and a dry run writes nothing", async () => {
    const dir = await caseDir(root, "nfr");
    await movie(dir, "b17-no-source", { source: "" });
    await movie(dir, "b17-no-license", { license: "" });
    await movie(dir, "b17-ok", { status: "PUBLISHED" });
    const before = await prisma.movie.count();
    const dry = await run(prisma, dir, { dryRun: true });
    expect(dry.code).toBe(0);
    expect(dry.created).toBe(1);
    expect(dry.skipped.map((item) => item.reason)).toEqual(
      expect.arrayContaining(["Thiếu source", "Thiếu license"]),
    );
    expect(await prisma.movie.count()).toBe(before);

    const imported = await run(prisma, dir, { only: "b17-ok" });
    expect(imported.code).toBe(0);
    const row = await prisma.movie.findUnique({
      where: { slug: "b17-ok" },
      include: { episodes: true },
    });
    expect(row?.status).toBe("DRAFT");
    expect(row?.publishedAt).toBeNull();
    expect(row?.episodes[0]?.streamUid).toBeNull();
    expect(await prisma.movie.count({ where: { slug: { startsWith: "b17-no" } } })).toBe(0);
  });

  it("uploads a file once, then skips the provider on the second run", async () => {
    const dir = await caseDir(root, "file");
    await movie(dir, "b17-file", { video: true });
    await movie(dir, "b17-other", { video: true });
    const video = provider();
    const uploaded: string[] = [];
    const first = await run(prisma, dir, {
      only: "b17-file",
      video,
      uploadFile: async (_url, file) => {
        uploaded.push(file);
      },
    });
    expect(first.code).toBe(0);
    expect(first.created).toBe(1);
    expect(video.createDirectUpload).toHaveBeenCalledWith({
      maxDurationSeconds: 3600,
      metaName: "b17-file/s1e1",
    });
    expect(uploaded).toHaveLength(1);
    const row = await prisma.movie.findUnique({
      where: { slug: "b17-file" },
      include: { episodes: { include: { subtitles: true } } },
    });
    expect(row?.episodes[0]?.streamUid).toBe("uid-b17-file/s1e1");
    expect(row?.episodes[0]?.subtitles[0]?.url).toBe("/media/subtitles/b17-file/s1e1.vi.vtt");
    expect(row?.posterUrl).toMatch(/^\/media\/posters\/b17-file-/);
    expect(await prisma.movie.findUnique({ where: { slug: "b17-other" } })).toBeNull();

    video.createDirectUpload.mockClear();
    const second = await run(prisma, dir, { only: "b17-file", video });
    expect(second.updated).toBe(1);
    expect(video.createDirectUpload).not.toHaveBeenCalled();
    expect(await prisma.movie.count({ where: { slug: "b17-file" } })).toBe(1);
  });

  it("stops after a killed upload and does not upload again while the journal is in flight", async () => {
    const dir = await caseDir(root, "cut");
    await movie(dir, "b17-cut", { video: true });
    const video = provider();
    const cut = await run(prisma, dir, {
      video,
      uploadFile: async () => {
        throw new Error("killed");
      },
    });
    expect(cut.code).toBe(2);
    const journal = JSON.parse(await readFile(path.join(dir, "journal.json"), "utf8")) as {
      entries: Record<string, { status: string }>;
    };
    expect(journal.entries["b17-cut/s1e1"]?.status).toBe("IN_FLIGHT");
    video.createDirectUpload.mockClear();
    const resumed = await run(prisma, dir, { video });
    expect(resumed.code).toBe(3);
    expect(resumed.skipped[0]?.reason).toMatch(/mất câu trả lời/);
    expect(video.createDirectUpload).not.toHaveBeenCalled();
  });

  it("writes an uploaded uid without calling the provider again", async () => {
    const dir = await caseDir(root, "uploaded");
    await movie(dir, "b17-uploaded", { video: true });
    await writeFile(
      path.join(dir, "journal.json"),
      JSON.stringify({ entries: { "b17-uploaded/s1e1": { status: "UPLOADED", uid: "uid-kept" } } }),
    );
    const video = provider();
    const result = await run(prisma, dir, { video });
    expect(result.code).toBe(0);
    expect(video.createDirectUpload).not.toHaveBeenCalled();
    const episode = await prisma.episode.findFirst({ where: { movie: { slug: "b17-uploaded" } } });
    expect(episode?.streamUid).toBe("uid-kept");
  });

  it("copies an https link and refuses a Drive link without a stream uid", async () => {
    const dir = await caseDir(root, "link");
    await movie(dir, "b17-link", { videoUrl: "https://cdn.example/a.mp4" });
    await movie(dir, "b17-drive", { videoUrl: "https://drive.google.com/file/d/abc" });
    const video = provider();
    const copied = await run(prisma, dir, { only: "b17-link", video });
    expect(copied.code).toBe(0);
    expect(video.copyFromUrl).toHaveBeenCalledWith("https://cdn.example/a.mp4", "b17-link/s1e1");
    const drive = await run(prisma, dir, { only: "b17-drive", video });
    expect(drive.skipped.some((item) => item.reason.includes("Drive"))).toBe(true);
    expect(video.copyFromUrl).toHaveBeenCalledTimes(1);
    const driveRow = await prisma.episode.findFirst({ where: { movie: { slug: "b17-drive" } } });
    expect(driveRow?.streamUid).toBeNull();
  });

  it("keeps a published movie published when the same slug is imported again", async () => {
    const dir = await caseDir(root, "keep");
    await movie(dir, "b17-keep", {});
    await prisma.movie.create({
      data: {
        slug: "b17-keep",
        title: "Giữ",
        description: "Giữ",
        type: "MOVIE",
        releaseYear: 2024,
        ageRating: "P",
        status: "PUBLISHED",
        publishedAt: new Date("2026-11-01T00:00:00.000Z"),
      },
    });
    const result = await run(prisma, dir);
    expect(result.code).toBe(0);
    expect(result.updated).toBe(1);
    const row = await prisma.movie.findUnique({ where: { slug: "b17-keep" } });
    expect(row?.status).toBe("PUBLISHED");
    expect(row?.publishedAt?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("exits 3 before writing when the folder has more movies than --max", async () => {
    const dir = await caseDir(root, "max");
    await movie(dir, "b17-max-a", {});
    await movie(dir, "b17-max-b", {});
    const result = await run(prisma, dir, { max: 1 });
    expect(result.code).toBe(3);
    expect(await prisma.movie.count({ where: { slug: { startsWith: "b17-max" } } })).toBe(0);
  });
});

function provider(): VideoProvider & {
  createDirectUpload: jest.Mock;
  copyFromUrl: jest.Mock;
} {
  return {
    createPlaybackUrl: jest.fn(),
    getVideo: jest.fn(async (uid: string) => ({
      uid,
      durationSec: 90,
      requireSignedURLs: true,
      ready: true,
    })),
    createDirectUpload: jest.fn(async (request: { metaName: string }) => ({
      uid: `uid-${request.metaName}`,
      uploadUrl: "https://upload.example/file",
    })),
    copyFromUrl: jest.fn(async (_url: string, metaName: string) => ({ uid: `copy-${metaName}` })),
    enableSignedUrls: jest.fn(),
  };
}

function run(
  prisma: PrismaClient,
  dir: string,
  extra: {
    dryRun?: boolean;
    only?: string;
    max?: number;
    video?: VideoProvider;
    uploadFile?: (url: string, filePath: string) => Promise<void>;
  } = {},
): Promise<ImportResult> {
  return runImport({
    dir,
    dryRun: extra.dryRun,
    only: extra.only,
    max: extra.max,
    journalPath: path.join(dir, "journal.json"),
    prisma,
    video: extra.video ?? provider(),
    storage: new MediaStorage(path.join(dir, "media")),
    uploadFile: extra.uploadFile ?? (async () => undefined),
  });
}

async function caseDir(root: string, name: string): Promise<string> {
  const dir = path.join(root, name);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function movie(
  dir: string,
  slug: string,
  extra: { source?: string; license?: string; video?: boolean; videoUrl?: string; status?: string },
): Promise<void> {
  const folder = path.join(dir, slug);
  await mkdir(folder, { recursive: true });
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
  await writeFile(path.join(folder, "poster.png"), png);
  await writeFile(
    path.join(folder, "movie.vi.vtt"),
    "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nXin chào\n",
  );
  if (extra.video) await writeFile(path.join(folder, "movie.mp4"), Buffer.from("video"));
  await writeFile(
    path.join(folder, "metadata.json"),
    JSON.stringify({
      title: slug,
      slug,
      type: "MOVIE",
      releaseYear: 2024,
      description: "Mô tả nhập",
      genres: ["Hài"],
      countries: ["Việt Nam"],
      directors: ["Đạo Diễn"],
      cast: ["Diễn Viên"],
      ageRating: "P",
      status: extra.status,
      source: extra.source === undefined ? "https://example.com/phim" : extra.source,
      license:
        extra.license === undefined ? "Được chia sẻ cho nhóm dùng trong bản demo" : extra.license,
      ...(extra.videoUrl ? { videoUrl: extra.videoUrl } : {}),
    }),
  );
}
