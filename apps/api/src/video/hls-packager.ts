import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Logger } from "@nestjs/common";
import { driveDownloadUrl } from "./drive-clips";

const log = new Logger("HlsPackager");

type Job = {
  done: boolean;
  error: Error | null;
  process: ChildProcess | null;
};

const jobs = new Map<string, Job>();

export function ffmpegPath(): string {
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const localApp = process.env.LOCALAPPDATA;
  if (!localApp) return "ffmpeg";
  const portable = join(localApp, "FilmGenZ", "ffmpeg", "bin", "ffmpeg.exe");
  if (existsSync(portable)) return portable;
  const packages = join(localApp, "Microsoft", "WinGet", "Packages");
  if (!existsSync(packages)) return "ffmpeg";
  for (const entry of readdirSync(packages)) {
    if (!entry.startsWith("Gyan.FFmpeg")) continue;
    const nested = readdirSync(join(packages, entry)).find((name) => name.startsWith("ffmpeg-"));
    if (!nested) continue;
    const exe = join(packages, entry, nested, "bin", "ffmpeg.exe");
    if (existsSync(exe)) return exe;
  }
  return "ffmpeg";
}

export function hlsCacheDir(fileId: string): string {
  return join(tmpdir(), "filmgenz-hls", fileId);
}

export function packageMode(codec: string): "copy" | "h264" {
  return codec === "h264" ? "copy" : "h264";
}

export function reusePackage(complete: boolean, savedMode: string | null, wanted: "copy" | "h264"): boolean {
  return complete && (savedMode ?? "copy") === wanted;
}

export function startHlsPackage(fileId: string): void {
  if (jobs.has(fileId)) return;
  const job: Job = { done: false, error: null, process: null };
  jobs.set(fileId, job);
  void prepare(fileId, job);
}

async function prepare(fileId: string, job: Job): Promise<void> {
  const dir = hlsCacheDir(fileId);
  const mode = packageMode(await videoCodec(fileId));
  if (reusePackage(packageComplete(dir), readMode(dir), mode)) {
    job.done = true;
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const stderr: Buffer[] = [];
  const proc = spawn(ffmpegPath(), ffmpegArgs(fileId, dir, mode), { windowsHide: true });
  job.process = proc;
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr.push(chunk);
    if (stderr.length > 20) stderr.shift();
  });
  proc.on("error", (error) => {
    job.error = error;
    job.done = true;
    log.error(`Không chạy được ffmpeg cho ${fileId}: ${error.message}`);
  });
  proc.on("close", (code) => {
    job.done = true;
    if (code === 0) {
      writeFileSync(join(dir, "mode.txt"), mode);
      return;
    }
    if (!job.error) {
      const detail = Buffer.concat(stderr).toString("utf8").trim();
      job.error = new Error(detail || `ffmpeg thoát với mã ${code}`);
      log.error(`Cắt HLS lỗi cho ${fileId}: ${job.error.message}`);
    }
  });
}

export function readHlsPlaylist(fileId: string): string | null {
  const file = join(hlsCacheDir(fileId), "index.m3u8");
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

export async function waitForHlsSegment(fileId: string, name: string): Promise<string | null> {
  startHlsPackage(fileId);
  const dir = hlsCacheDir(fileId);
  const file = join(dir, name);
  const next = join(dir, nextSegmentName(name));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const job = jobs.get(fileId);
    if (job?.error) return null;
    if (existsSync(file) && (job?.done === true || existsSync(next))) return file;
    if (job?.done) return existsSync(file) ? file : null;
    await wait(200);
  }
  return null;
}

function ffmpegArgs(fileId: string, dir: string, mode: "copy" | "h264"): string[] {
  const encode = mode === "h264";
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-user_agent",
    "FilmGenZ",
    "-i",
    driveDownloadUrl(fileId),
    ...(encode
      ? [
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-g",
          "72",
          "-keyint_min",
          "72",
          "-sc_threshold",
          "0",
          "-force_key_frames",
          "expr:gte(t,n_forced*6)",
          "-c:a",
          "aac",
          "-ac",
          "2",
          "-b:a",
          "128k",
        ]
      : ["-c", "copy", "-avoid_negative_ts", "make_zero"]),
    "-f",
    "hls",
    "-hls_time",
    "6",
    "-hls_list_size",
    "0",
    "-hls_playlist_type",
    "event",
    "-hls_flags",
    encode ? "independent_segments" : "independent_segments+split_by_time",
    "-hls_segment_filename",
    join(dir, "seg%03d.ts"),
    "-start_number",
    "0",
    join(dir, "index.m3u8"),
  ];
}

function videoCodec(fileId: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(
      ffprobePath(),
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "csv=p=0",
        driveDownloadUrl(fileId),
      ],
      { windowsHide: true },
    );
    let out = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      proc.kill();
      resolve("unknown");
    }, 30_000);
    proc.on("error", () => {
      clearTimeout(timer);
      resolve("unknown");
    });
    proc.on("close", () => {
      clearTimeout(timer);
      resolve(out.trim().split(/\s+/)[0] || "unknown");
    });
  });
}

function ffprobePath(): string {
  const ffmpeg = ffmpegPath();
  const sibling = join(dirname(ffmpeg), process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  return existsSync(sibling) ? sibling : "ffprobe";
}

function readMode(dir: string): string | null {
  try {
    return readFileSync(join(dir, "mode.txt"), "utf8").trim();
  } catch {
    return null;
  }
}

function packageComplete(dir: string): boolean {
  const file = join(dir, "index.m3u8");
  if (!existsSync(file)) return false;
  return readFileSync(file, "utf8").includes("#EXT-X-ENDLIST");
}

function nextSegmentName(name: string): string {
  const number = Number(name.slice(3, 6)) + 1;
  return `seg${String(number).padStart(3, "0")}.ts`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
