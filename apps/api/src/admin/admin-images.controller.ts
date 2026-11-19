import { IMAGE_MAX_BYTES } from "@movie/contracts";
import {
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../auth/auth.decorators";
import { AdminAssetsService, type UploadedFile as Upload } from "./admin-assets.service";

@Roles("ADMIN")
@Controller("admin/movies")
export class AdminImagesController {
  constructor(private readonly assets: AdminAssetsService) {}

  @Post(":id/images/:kind")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: IMAGE_MAX_BYTES } }))
  save(
    @Param("id", ParseIntPipe) id: number,
    @Param("kind") kind: string,
    @UploadedFile() file?: Upload,
  ) {
    return this.assets.saveImage(id, kind, file);
  }
}
