import type { AdminGenre } from "@movie/contracts";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
import { CreateGenreDto, UpdateGenreDto } from "./admin-genres.dto";
import { AdminGenresService } from "./admin-genres.service";

@Roles("ADMIN")
@Controller("admin/genres")
export class AdminGenresController {
  constructor(private readonly genres: AdminGenresService) {}

  @Get()
  list(): Promise<AdminGenre[]> {
    return this.genres.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateGenreDto): Promise<AdminGenre> {
    return this.genres.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateGenreDto): Promise<AdminGenre> {
    return this.genres.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.genres.remove(id);
  }
}
