import { Controller, Get, Param, Query, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Public } from "../auth/auth.decorators";
import { errorBody } from "../common/app-error";
import type { ApiEnv } from "../config/env.schema";
import { acceptDriveTicket, driveDownloadUrl } from "./drive-clips";

type StreamResponse = NodeJS.WritableStream & {
  status(code: number): StreamResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  headersSent: boolean;
  end(): void;
  off(event: string, listener: () => void): void;
};

@Public()
@Controller("video")
export class DriveStreamController {
  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  @Get("drive/:fileId")
  async stream(
    @Param("fileId") fileId: string,
    @Query("exp") exp: string | undefined,
    @Query("sig") sig: string | undefined,
    @Req() req: { headers: { range?: string | string[] } },
    @Res() res: StreamResponse,
  ): Promise<void> {
    if (!acceptDriveTicket(fileId, exp, sig, this.config.getOrThrow("JWT_SECRET"), new Date())) {
      res.status(404).json(errorBody("NOT_FOUND"));
      return;
    }
    await pipeDriveMp4(fileId, headerValue(req.headers.range), res);
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function pipeDriveMp4(
  fileId: string,
  range: string | undefined,
  res: StreamResponse,
): Promise<void> {
  const abort = new AbortController();
  const stop = () => abort.abort();
  res.once("close", stop);
  try {
    const upstream = await fetch(driveDownloadUrl(fileId), {
      headers: range ? { Range: range } : undefined,
      redirect: "follow",
      signal: abort.signal,
    });
    if (upstream.status !== 200 && upstream.status !== 206) {
      res.off("close", stop);
      if (!res.headersSent) res.status(502).end();
      return;
    }
    const type = upstream.headers.get("content-type") ?? "";
    if (type.includes("text/html") || !upstream.body) {
      res.off("close", stop);
      if (!res.headersSent) res.status(502).end();
      return;
    }
    res.status(upstream.status);
    res.setHeader("Content-Type", type.startsWith("video/") ? type : "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, max-age=3600");
    copyHeader(upstream, res, "content-length");
    copyHeader(upstream, res, "content-range");
    const nodeStream = Readable.fromWeb(upstream.body as unknown as NodeReadableStream);
    nodeStream.on("end", () => res.off("close", stop));
    nodeStream.on("error", () => {
      if (!res.headersSent) res.status(502);
      res.end();
    });
    nodeStream.pipe(res);
  } catch {
    res.off("close", stop);
    if (!res.headersSent && !abort.signal.aborted) res.status(502).end();
  }
}

function copyHeader(upstream: globalThis.Response, res: StreamResponse, name: string): void {
  const value = upstream.headers.get(name);
  if (value) res.setHeader(name, value);
}
