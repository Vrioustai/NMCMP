import { createReadStream } from "node:fs";
import { Controller, Get, OnModuleInit, Param, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/auth.decorators";
import { errorBody } from "../common/app-error";
import type { ApiEnv } from "../config/env.schema";
import { acceptDriveTicket, hlsFileIds, isHlsDriveFile } from "./drive-clips";
import { hlsSegmentUrl, isHlsSegmentName, placeholderPlaylist, rewriteHlsPlaylist } from "./hls-playlist";
import { readHlsPlaylist, startHlsPackage, waitForHlsSegment } from "./hls-packager";

type StreamResponse = NodeJS.WritableStream & {
  status(code: number): StreamResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(body?: string): void;
};

@Public()
@Controller("video/hls")
export class HlsStreamController implements OnModuleInit {
  constructor(private readonly config: ConfigService<ApiEnv, true>) {}

  onModuleInit(): void {
    for (const fileId of hlsFileIds()) startHlsPackage(fileId);
  }

  @Get(":fileId/index.m3u8")
  playlist(
    @Param("fileId") fileId: string,
    @Query("exp") exp: string | undefined,
    @Query("sig") sig: string | undefined,
    @Res() res: StreamResponse,
  ): void {
    if (!this.allowed(fileId, exp, sig)) {
      res.status(404).json(errorBody("NOT_FOUND"));
      return;
    }
    startHlsPackage(fileId);
    const segment = (name: string) =>
      hlsSegmentUrl(this.config.getOrThrow("WEB_ORIGIN"), fileId, name, exp ?? "", sig ?? "");
    const raw = readHlsPlaylist(fileId);
    const body = (raw && rewriteHlsPlaylist(raw, segment)) || placeholderPlaylist(segment("seg000.ts"));
    res.status(200);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  }

  @Get(":fileId/:segment")
  async segment(
    @Param("fileId") fileId: string,
    @Param("segment") segment: string,
    @Query("exp") exp: string | undefined,
    @Query("sig") sig: string | undefined,
    @Res() res: StreamResponse,
  ): Promise<void> {
    if (!this.allowed(fileId, exp, sig) || !isHlsSegmentName(segment)) {
      res.status(404).json(errorBody("NOT_FOUND"));
      return;
    }
    const file = await waitForHlsSegment(fileId, segment);
    if (!file) {
      res.status(502).end();
      return;
    }
    res.status(200);
    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Cache-Control", "private, max-age=3600");
    createReadStream(file).pipe(res);
  }

  private allowed(fileId: string, exp: string | undefined, sig: string | undefined): boolean {
    return (
      isHlsDriveFile(fileId) &&
      acceptDriveTicket(fileId, exp, sig, this.config.getOrThrow("JWT_SECRET"), new Date())
    );
  }
}
