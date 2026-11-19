import { SUBTITLE_MAX_BYTES } from "@movie/contracts";
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../auth/auth.decorators";
import type { UploadedFile as Upload } from "./admin-assets.service";
import { AdminAssetsService } from "./admin-assets.service";
import {
  CreateEpisodeDto,
  DirectUploadDto,
  SetStreamDto,
  StreamCopyDto,
  UpdateEpisodeDto,
} from "./admin-episodes.dto";
import { AdminEpisodesService, type AdminEpisode } from "./admin-episodes.service";

@Roles("ADMIN")
@Controller()
export class AdminEpisodesController {
  constructor(
    private readonly episodes: AdminEpisodesService,
    private readonly assets: AdminAssetsService,
  ) {}

  @Post("admin/movies/:movieId/episodes")
  @HttpCode(201)
  create(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Body() dto: CreateEpisodeDto,
  ): Promise<AdminEpisode> {
    return this.episodes.create(movieId, dto);
  }

  @Patch("admin/episodes/:id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEpisodeDto,
  ): Promise<AdminEpisode> {
    return this.episodes.update(id, dto);
  }

  @Delete("admin/episodes/:id")
  @HttpCode(204)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.episodes.remove(id);
  }

  @Put("admin/episodes/:id/stream")
  setStream(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SetStreamDto,
  ): Promise<AdminEpisode> {
    return this.episodes.setStream(id, dto);
  }

  @Post("admin/episodes/:id/stream-upload")
  createUpload(@Param("id", ParseIntPipe) id: number, @Body() dto: DirectUploadDto) {
    return this.episodes.createUpload(id, dto);
  }

  @Post("admin/episodes/:id/stream-copy")
  copyStream(@Param("id", ParseIntPipe) id: number, @Body() dto: StreamCopyDto) {
    return this.episodes.copyStream(id, dto);
  }

  @Put("admin/episodes/:id/subtitles/:language")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: SUBTITLE_MAX_BYTES } }))
  saveSubtitle(
    @Param("id", ParseIntPipe) id: number,
    @Param("language") language: string,
    @UploadedFile() file?: Upload,
  ) {
    return this.assets.saveSubtitle(id, language, file);
  }

  @Delete("admin/episodes/:id/subtitles/:language")
  @HttpCode(204)
  async removeSubtitle(
    @Param("id", ParseIntPipe) id: number,
    @Param("language") language: string,
  ): Promise<void> {
    await this.assets.removeSubtitle(id, language);
  }
}
