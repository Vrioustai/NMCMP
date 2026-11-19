import { mkdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { AppError } from "../common/app-error";

const LONG_CACHE = "public, max-age=31536000, immutable";

type MediaRequest = { method: string; path: string };
type MediaResponse = {
  status(code: number): { json(body: unknown): void };
  type(value: string): void;
  setHeader(name: string, value: string): void;
  sendFile(file: string, callback: (error: Error | null) => void): void;
  headersSent: boolean;
};
type Next = (error?: unknown) => void;

export class MediaStorage {
  readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  resolveRequestPath(requestPath: string): string | null {
    return resolveInside(this.root, requestPath);
  }

  async save(relativePath: string, bytes: Buffer): Promise<string> {
    const file = this.requiredFile(relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return relativePath
      .split(/[/\\]+/)
      .filter(Boolean)
      .join("/");
  }

  async remove(relativePath: string): Promise<void> {
    await rm(this.requiredFile(relativePath), { force: true });
  }

  private requiredFile(relativePath: string): string {
    const file = resolveInside(this.root, `/${relativePath}`);
    if (!file) throw new AppError("VALIDATION_FAILED", "Đường dẫn tệp không hợp lệ");
    return file;
  }
}

export function createMediaHandler(storage: MediaStorage) {
  return async (req: MediaRequest, res: MediaResponse, next: Next): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    const file = storage.resolveRequestPath(req.path);
    if (!file) {
      res.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Đường dẫn tệp không hợp lệ" },
      });
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy" } });
        return;
      }
    } catch {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy" } });
      return;
    }
    if (file.endsWith(".vtt")) res.type("text/vtt; charset=utf-8");
    if (/\.(webp|jpe?g|png)$/i.test(file)) res.setHeader("Cache-Control", LONG_CACHE);
    res.sendFile(file, (error) => {
      if (!error || res.headersSent) return;
      res
        .status(500)
        .json({ error: { code: "INTERNAL", message: "Có lỗi xảy ra, vui lòng thử lại" } });
    });
  };
}

export function mediaRelative(url: string | null): string | null {
  if (!url?.startsWith("/media/")) return null;
  const relative = url.slice("/media/".length);
  if (!relative || relative.split("/").includes("..")) return null;
  return relative;
}

export function resolveInside(root: string, requestPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const segments = decoded.split(/[/\\]+/).filter((part) => part.length > 0);
  if (segments.length === 0) return null;
  if (segments.some((part) => part === "." || part === ".." || part.startsWith("."))) return null;
  const rootResolved = path.resolve(root);
  const full = path.resolve(rootResolved, ...segments);
  if (!full.startsWith(rootResolved + path.sep)) return null;
  return full;
}
