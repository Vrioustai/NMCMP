import { loadEnvFile } from "node:process";
import { homedir } from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseEnv } from "../src/config/env.schema";
import { runImport } from "../src/import/import-movies";
import { MediaStorage } from "../src/media/media-storage";
import { createVideoProvider } from "../src/video/video.module";
import type { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../src/config/env.schema";

// Nhật ký nằm ngoài repo để lần chạy đứt không bị commit nhầm.
const DEFAULT_JOURNAL = path.join(homedir(), ".filmgenz", "import-journal.json");

try {
  loadEnvFile();
} catch (error) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code !== "ENOENT") throw error;
}

async function main(): Promise<number> {
  const args = readArgs(process.argv.slice(2));
  const env = parseEnv(process.env);
  const prisma = new PrismaClient();
  try {
    const result = await runImport({
      dir: args.dir,
      dryRun: args.dryRun,
      only: args.only,
      max: args.max,
      journalPath: DEFAULT_JOURNAL,
      prisma,
      video: createVideoProvider(configOf(env)),
      storage: new MediaStorage(env.MEDIA_DIR),
    });
    if (args.dryRun) console.log("Chạy thử, không ghi.");
    console.log(
      `Tạo: ${result.created}. Cập nhật: ${result.updated}. Bỏ qua: ${result.skipped.length}.`,
    );
    for (const item of result.skipped) console.log(`- ${item.slug}: ${item.reason}`);
    return result.code;
  } finally {
    await prisma.$disconnect();
  }
}

function readArgs(argv: string[]): { dir: string; dryRun: boolean; only?: string; max: number } {
  let dir = "";
  let dryRun = false;
  let only: string | undefined;
  let max = 20;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--dir") dir = argv[(index += 1)] ?? "";
    else if (arg === "--only") only = argv[(index += 1)];
    else if (arg === "--max") max = Number(argv[(index += 1)]);
  }
  if (!dir) throw new Error("Thiếu --dir.");
  if (!Number.isInteger(max) || max < 1) throw new Error("--max không hợp lệ.");
  return { dir, dryRun, only, max };
}

function configOf(env: ApiEnv): ConfigService<ApiEnv, true> {
  return {
    get: (key: keyof ApiEnv) => env[key],
    getOrThrow: (key: keyof ApiEnv) => {
      const value = env[key];
      if (value === undefined || value === "") throw new Error(`${String(key)} chưa được đặt.`);
      return value;
    },
  } as ConfigService<ApiEnv, true>;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Không chạy được script nhập phim.");
    process.exit(1);
  });
