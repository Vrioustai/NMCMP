import { readFile, readdir, rename, stat, writeFile, mkdir } from "fs/promises";
import path from "path";
import { VIDEO_DIRECT_UPLOAD_MAX_BYTES, type AgeRating, AGE_RATINGS } from "@movie/contracts";
import type { PrismaClient } from "@prisma/client";
import { AdminAssetsService } from "../admin/admin-assets.service";
import type { PrismaService } from "../prisma/prisma.service";
import { MediaStorage } from "../media/media-storage";
import type { VideoProvider } from "../video/video-provider";

const UPLOAD_TIMEOUT_MS = 30_000;
const DIRECT_UPLOAD_SECONDS = 3_600;

export type ImportCode = 0 | 1 | 2 | 3;

export type ImportSkip = { slug: string; reason: string };

export type ImportResult = {
  code: ImportCode;
  created: number;
  updated: number;
  skipped: ImportSkip[];
};

type JournalStatus = "IN_FLIGHT" | "UPLOADED" | "DONE";

type JournalEntry = { status: JournalStatus; uid?: string };

type Metadata = {
  title?: string;
  originalTitle?: string | null;
  slug?: string;
  type?: string;
  releaseYear?: number;
  description?: string;
  genres?: string[];
  countries?: string[];
  directors?: string[];
  cast?: string[];
  ageRating?: string;
  source?: string;
  license?: string;
  trailerUrl?: string | null;
  videoUrl?: string;
  seasons?: {
    number?: number;
    episodes?: { number?: number; title?: string; videoUrl?: string }[];
  }[];
};

type EpisodeSource = {
  season: number;
  number: number;
  title: string | null;
  videoFile: string | null;
  videoUrl: string | null;
  subtitle: string | null;
};

export type ImportOptions = {
  dir: string;
  dryRun?: boolean;
  only?: string;
  max?: number;
  journalPath: string;
  prisma: PrismaClient;
  video: VideoProvider;
  storage: MediaStorage;
  uploadFile?: (url: string, filePath: string) => Promise<void>;
};

export function exceedsDirectUpload(bytes: number): boolean {
  return bytes > VIDEO_DIRECT_UPLOAD_MAX_BYTES;
}

export function rejectedVideoUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Link video phải là URL https";
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return "Link video phải là URL https";
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "drive.google.com" ||
    host.endsWith(".drive.google.com") ||
    host === "docs.google.com" ||
    host.endsWith(".docs.google.com")
  ) {
    return "Không nhận link Google Drive";
  }
  return null;
}

export async function runImport(options: ImportOptions): Promise<ImportResult> {
  const max = options.max ?? 20;
  const empty = { created: 0, updated: 0, skipped: [] as ImportSkip[] };
  let folder: string;
  try {
    folder = path.resolve(options.dir);
    const info = await stat(folder);
    if (!info.isDirectory())
      return { code: 1, ...empty, skipped: [{ slug: folder, reason: "Không phải thư mục" }] };
  } catch {
    return { code: 1, ...empty, skipped: [{ slug: options.dir, reason: "Không thấy thư mục" }] };
  }

  const slugs = (await movieFolders(folder)).filter(
    (slug) => !options.only || slug === options.only,
  );
  if (options.only && slugs.length === 0) {
    return {
      code: 0,
      ...empty,
      skipped: [{ slug: options.only, reason: "Không thấy thư mục phim" }],
    };
  }
  if (slugs.length > max) {
    return {
      code: 3,
      ...empty,
      skipped: [{ slug: folder, reason: `Vượt --max ${max}` }],
    };
  }

  let journal: Map<string, JournalEntry>;
  try {
    journal = await readJournal(options.journalPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "import-journal.json không đọc được.";
    return { code: 1, ...empty, skipped: [{ slug: folder, reason }] };
  }
  const assets = new AdminAssetsService(
    options.prisma as unknown as PrismaService,
    options.storage,
  );
  const upload = options.uploadFile ?? uploadVideoFile;
  let created = 0;
  let updated = 0;
  let wrote = false;
  const skipped: ImportSkip[] = [];

  try {
    for (const slug of slugs) {
      const outcome = await importFolder({
        folder: path.join(folder, slug),
        slug,
        dryRun: options.dryRun === true,
        journal,
        journalPath: options.journalPath,
        prisma: options.prisma,
        video: options.video,
        assets,
        upload,
        onWrote: () => {
          wrote = true;
        },
      });
      if (outcome.kind === "skip") skipped.push({ slug, reason: outcome.reason });
      if (outcome.kind === "created") created += 1;
      if (outcome.kind === "updated") updated += 1;
      if (outcome.kind === "inflight") {
        skipped.push({ slug, reason: outcome.reason });
        return { code: 3, created, updated, skipped };
      }
      for (const reason of outcome.warnings ?? []) skipped.push({ slug, reason });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Lỗi khi nhập";
    skipped.push({ slug: folder, reason });
    return { code: wrote ? 2 : 1, created, updated, skipped };
  }

  return { code: 0, created, updated, skipped };
}

async function importFolder(input: {
  folder: string;
  slug: string;
  dryRun: boolean;
  journal: Map<string, JournalEntry>;
  journalPath: string;
  prisma: PrismaClient;
  video: VideoProvider;
  assets: AdminAssetsService;
  upload: (url: string, filePath: string) => Promise<void>;
  onWrote: () => void;
}): Promise<{
  kind: "skip" | "created" | "updated" | "inflight";
  reason: string;
  warnings?: string[];
}> {
  let raw: Metadata;
  try {
    const text = (await readFile(path.join(input.folder, "metadata.json"), "utf8")).replace(
      /^\uFEFF/,
      "",
    );
    raw = JSON.parse(text) as Metadata;
  } catch {
    return { kind: "skip", reason: "metadata.json không đọc được" };
  }
  const problem = metadataProblem(raw, input.slug);
  if (problem) return { kind: "skip", reason: problem };
  const meta = raw as Required<
    Pick<
      Metadata,
      "title" | "slug" | "type" | "releaseYear" | "description" | "ageRating" | "source" | "license"
    >
  >;
  const episodes = await episodeSources(input.folder, raw);
  if ("error" in episodes) return { kind: "skip", reason: episodes.error };

  for (const episode of episodes) {
    const key = metaName(meta.slug, episode.season, episode.number);
    if (input.journal.get(key)?.status === "IN_FLIGHT") {
      return {
        kind: "inflight",
        reason: `Lần trước có thể đã gửi video mà mất câu trả lời. Tìm theo tên ${key} rồi chạy tiếp.`,
      };
    }
  }

  if (input.dryRun) {
    const existing = await input.prisma.movie.findUnique({
      where: { slug: meta.slug },
      select: { id: true },
    });
    return {
      kind: existing ? "updated" : "created",
      reason: "",
      warnings: await videoWarnings(episodes),
    };
  }

  const warnings: string[] = [];
  const existing = await input.prisma.movie.findUnique({
    where: { slug: meta.slug },
    select: { id: true },
  });
  const movieId = await saveMovie(input.prisma, meta, episodes, existing?.id);
  input.onWrote();
  await saveImages(input.assets, movieId, input.folder, warnings);
  for (const episode of episodes) {
    const row = await input.prisma.episode.findUnique({
      where: {
        movieId_seasonNumber_number: {
          movieId,
          seasonNumber: episode.season,
          number: episode.number,
        },
      },
    });
    if (!row) continue;
    if (episode.subtitle) {
      const bytes = await readFile(episode.subtitle);
      await input.assets.saveSubtitle(row.id, "vi", { buffer: bytes, size: bytes.length });
    }
    const note = await attachVideo(input, meta.slug, episode, row.id, row.streamUid);
    if (note) warnings.push(note);
  }
  return { kind: existing ? "updated" : "created", reason: "", warnings };
}

async function attachVideo(
  input: {
    journal: Map<string, JournalEntry>;
    journalPath: string;
    prisma: PrismaClient;
    video: VideoProvider;
    upload: (url: string, filePath: string) => Promise<void>;
  },
  slug: string,
  episode: EpisodeSource,
  episodeId: number,
  streamUid: string | null,
): Promise<string | null> {
  const key = metaName(slug, episode.season, episode.number);
  if (streamUid) return null;
  const marked = input.journal.get(key);
  if (marked?.status === "UPLOADED" && marked.uid) {
    await rememberUid(input, episodeId, marked.uid, key);
    return null;
  }
  if (marked?.status === "DONE") return null;

  let file = episode.videoFile;
  if (file) {
    const size = (await stat(file)).size;
    if (exceedsDirectUpload(size)) {
      file = null;
      if (!episode.videoUrl) return `Tập ${episode.number} lớn hơn 200 MB, bỏ qua video`;
    }
  }
  if (!file && !episode.videoUrl) return null;
  if (episode.videoUrl) {
    const rejected = rejectedVideoUrl(episode.videoUrl);
    if (rejected) return rejected;
  }

  await putJournal(input.journalPath, input.journal, key, { status: "IN_FLIGHT" });
  const uid = file
    ? await uploadLocal(input.video, input.upload, file, key)
    : (await input.video.copyFromUrl(episode.videoUrl as string, key)).uid;
  await putJournal(input.journalPath, input.journal, key, { status: "UPLOADED", uid });
  await rememberUid(input, episodeId, uid, key);
  return null;
}

async function uploadLocal(
  video: VideoProvider,
  upload: (url: string, filePath: string) => Promise<void>,
  file: string,
  key: string,
): Promise<string> {
  const ticket = await video.createDirectUpload({
    maxDurationSeconds: DIRECT_UPLOAD_SECONDS,
    metaName: key,
  });
  await upload(ticket.uploadUrl, file);
  return ticket.uid;
}

async function rememberUid(
  input: {
    prisma: PrismaClient;
    video: VideoProvider;
    journalPath: string;
    journal: Map<string, JournalEntry>;
  },
  episodeId: number,
  uid: string,
  key: string,
): Promise<void> {
  let durationSec: number | null = null;
  try {
    const details = await input.video.getVideo(uid);
    if (details.durationSec != null && Number.isFinite(details.durationSec)) {
      durationSec = Math.round(details.durationSec);
    }
  } catch {
    durationSec = null;
  }
  await input.prisma.episode.update({
    where: { id: episodeId },
    data: { streamUid: uid, durationSec },
  });
  await putJournal(input.journalPath, input.journal, key, { status: "DONE", uid });
}

async function saveMovie(
  prisma: PrismaClient,
  meta: Metadata,
  episodes: EpisodeSource[],
  existingId: number | undefined,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const data = {
      title: meta.title as string,
      originalTitle: textOrNull(meta.originalTitle),
      description: meta.description as string,
      type: meta.type as "MOVIE" | "SERIES",
      releaseYear: meta.releaseYear as number,
      ageRating: meta.ageRating as AgeRating,
      trailerUrl: textOrNull(meta.trailerUrl),
      sourceUrl: meta.source,
      license: meta.license,
    };
    const movie = existingId
      ? await tx.movie.update({ where: { id: existingId }, data })
      : await tx.movie.create({
          data: { ...data, slug: meta.slug as string, status: "DRAFT", publishedAt: null },
        });
    const genreIds: number[] = [];
    for (const name of unique(meta.genres ?? [])) {
      const found = await tx.genre.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      const genre = found ?? (await tx.genre.create({ data: { name }, select: { id: true } }));
      genreIds.push(genre.id);
    }
    await tx.movieGenre.deleteMany({ where: { movieId: movie.id } });
    if (genreIds.length > 0) {
      await tx.movieGenre.createMany({
        data: genreIds.map((genreId) => ({ movieId: movie.id, genreId })),
      });
    }
    await tx.movieCountry.deleteMany({ where: { movieId: movie.id } });
    for (const name of unique(meta.countries ?? [])) {
      const country =
        (await tx.country.findUnique({ where: { name } })) ??
        (await tx.country.create({ data: { name } }));
      await tx.movieCountry.create({ data: { movieId: movie.id, countryId: country.id } });
    }
    await tx.movieCredit.deleteMany({ where: { movieId: movie.id } });
    for (const name of unique(meta.directors ?? [])) {
      const person = await personId(tx, name);
      await tx.movieCredit.create({
        data: { movieId: movie.id, personId: person, role: "DIRECTOR" },
      });
    }
    for (const name of unique(meta.cast ?? [])) {
      const person = await personId(tx, name);
      await tx.movieCredit.create({ data: { movieId: movie.id, personId: person, role: "ACTOR" } });
    }
    for (const episode of episodes) {
      await tx.episode.upsert({
        where: {
          movieId_seasonNumber_number: {
            movieId: movie.id,
            seasonNumber: episode.season,
            number: episode.number,
          },
        },
        create: {
          movieId: movie.id,
          seasonNumber: episode.season,
          number: episode.number,
          title: episode.title,
        },
        update: { title: episode.title },
      });
    }
    return movie.id;
  });
}

async function personId(tx: Pick<PrismaClient, "person">, name: string): Promise<number> {
  const found = await tx.person.findFirst({ where: { name }, select: { id: true } });
  if (found) return found.id;
  const created = await tx.person.create({ data: { name }, select: { id: true } });
  return created.id;
}

async function saveImages(
  assets: AdminAssetsService,
  movieId: number,
  folder: string,
  warnings: string[],
): Promise<void> {
  for (const kind of ["poster", "backdrop"] as const) {
    const file = await firstFile(folder, [
      `${kind}.jpg`,
      `${kind}.jpeg`,
      `${kind}.png`,
      `${kind}.webp`,
    ]);
    if (!file) continue;
    try {
      const bytes = await readFile(file);
      await assets.saveImage(movieId, kind, { buffer: bytes, size: bytes.length });
    } catch {
      warnings.push(`Không lưu được ảnh ${kind}`);
    }
  }
}

async function videoWarnings(episodes: EpisodeSource[]): Promise<string[]> {
  const warnings: string[] = [];
  for (const episode of episodes) {
    if (episode.videoUrl) {
      const rejected = rejectedVideoUrl(episode.videoUrl);
      if (rejected) warnings.push(rejected);
    }
    if (!episode.videoFile) continue;
    const size = (await stat(episode.videoFile)).size;
    if (exceedsDirectUpload(size) && !episode.videoUrl) {
      warnings.push(`Tập ${episode.number} lớn hơn 200 MB, bỏ qua video`);
    }
  }
  return warnings;
}

function metadataProblem(meta: Metadata, folderSlug: string): string | null {
  if (!meta.source?.trim()) return "Thiếu source";
  if (!meta.license?.trim()) return "Thiếu license";
  if (meta.slug !== folderSlug) return "Slug không khớp thư mục";
  if (!meta.title?.trim() || !meta.description?.trim()) return "Thiếu tiêu đề hoặc mô tả";
  if (meta.type !== "MOVIE" && meta.type !== "SERIES") return "Loại phim không hợp lệ";
  if (!Number.isInteger(meta.releaseYear)) return "Năm phát hành không hợp lệ";
  if (!AGE_RATINGS.includes(meta.ageRating as AgeRating)) return "Nhãn độ tuổi không hợp lệ";
  if (!meta.genres?.some((name) => name.trim())) return "Thiếu thể loại";
  return null;
}

async function episodeSources(
  folder: string,
  meta: Metadata,
): Promise<EpisodeSource[] | { error: string }> {
  const seasons = await listSeasons(folder);
  const movieFile = await existing(path.join(folder, "movie.mp4"));
  if (movieFile && seasons.length > 0) return { error: "Không đặt movie.mp4 cùng thư mục mùa" };
  if (meta.type === "MOVIE") {
    return [
      {
        season: 1,
        number: 1,
        title: null,
        videoFile: movieFile,
        videoUrl: meta.videoUrl ?? null,
        subtitle: await existing(path.join(folder, "movie.vi.vtt")),
      },
    ];
  }
  const titled = new Map<string, { title?: string; videoUrl?: string }>();
  for (const season of meta.seasons ?? []) {
    for (const episode of season.episodes ?? []) {
      if (season.number && episode.number)
        titled.set(`${season.number}:${episode.number}`, episode);
    }
  }
  const found: EpisodeSource[] = [];
  for (const season of seasons) {
    for (const file of await readdir(season.dir)) {
      const match = /^episode-(\d+)\.mp4$/.exec(file);
      if (!match || match[1] === undefined) continue;
      const number = Number(match[1]);
      const extra = titled.get(`${season.number}:${number}`);
      found.push({
        season: season.number,
        number,
        title: extra?.title ?? null,
        videoFile: path.join(season.dir, file),
        videoUrl: extra?.videoUrl ?? null,
        subtitle: await existing(path.join(season.dir, `episode-${match[1]}.vi.vtt`)),
      });
      titled.delete(`${season.number}:${number}`);
    }
  }
  for (const [key, extra] of titled) {
    const [season, number] = key.split(":").map(Number);
    if (season === undefined || number === undefined) continue;
    found.push({
      season,
      number,
      title: extra.title ?? null,
      videoFile: null,
      videoUrl: extra.videoUrl ?? null,
      subtitle: null,
    });
  }
  found.sort((left, right) => left.season - right.season || left.number - right.number);
  return found;
}

function metaName(slug: string, season: number, number: number): string {
  return `${slug}/s${season}e${number}`;
}

async function movieFolders(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const slugs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await existing(path.join(dir, entry.name, "metadata.json"))) slugs.push(entry.name);
  }
  return slugs.sort();
}

async function listSeasons(folder: string): Promise<{ number: number; dir: string }[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const seasons: { number: number; dir: string }[] = [];
  for (const entry of entries) {
    const match = /^season-(\d+)$/.exec(entry.name);
    if (entry.isDirectory() && match?.[1])
      seasons.push({ number: Number(match[1]), dir: path.join(folder, entry.name) });
  }
  return seasons;
}

async function firstFile(folder: string, names: string[]): Promise<string | null> {
  for (const name of names) {
    const file = await existing(path.join(folder, name));
    if (file) return file;
  }
  return null;
}

async function existing(file: string): Promise<string | null> {
  try {
    const info = await stat(file);
    return info.isFile() ? file : null;
  } catch {
    return null;
  }
}

function unique(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    const key = trimmed.toLocaleLowerCase("vi");
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function textOrNull(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function nodeCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function readJournal(file: string): Promise<Map<string, JournalEntry>> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as {
      entries?: Record<string, JournalEntry>;
    };
    return new Map(Object.entries(parsed.entries ?? {}));
  } catch (error) {
    const code = nodeCode(error);
    if (code === "ENOENT") return new Map();
    throw new Error("import-journal.json không đọc được.");
  }
}

async function putJournal(
  file: string,
  journal: Map<string, JournalEntry>,
  key: string,
  entry: JournalEntry,
): Promise<void> {
  journal.set(key, entry);
  await mkdir(path.dirname(file), { recursive: true });
  const body = JSON.stringify({ entries: Object.fromEntries(journal) }, null, 2);
  const temporary = `${file}.tmp`;
  await writeFile(temporary, body);
  await rename(temporary, file);
}

export async function uploadVideoFile(url: string, filePath: string): Promise<void> {
  const bytes = await readFile(filePath);
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(bytes)]), path.basename(filePath));
  const response = await fetch(url, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Tải video không thành công.");
}
