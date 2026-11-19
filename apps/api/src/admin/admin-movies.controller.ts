import type { AdminMovieDetail, AdminMovieList } from "@movie/contracts";
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
  Query,
} from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
import {
  AdminMovieQueryDto,
  CreateMovieDto,
  MovieStatusDto,
  UpdateMovieDto,
} from "./admin-movies.dto";
import { AdminMoviesService } from "./admin-movies.service";

@Roles("ADMIN")
@Controller("admin/movies")
export class AdminMoviesController {
  constructor(private readonly movies: AdminMoviesService) {}

  @Get()
  list(@Query() query: AdminMovieQueryDto): Promise<AdminMovieList> {
    return this.movies.list(query);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateMovieDto): Promise<AdminMovieDetail> {
    return this.movies.create(dto);
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number): Promise<AdminMovieDetail> {
    return this.movies.get(id);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMovieDto,
  ): Promise<AdminMovieDetail> {
    return this.movies.update(id, dto);
  }

  @Patch(":id/status")
  setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MovieStatusDto,
  ): Promise<AdminMovieDetail> {
    return this.movies.setStatus(id, dto.status);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.movies.remove(id);
  }
}
