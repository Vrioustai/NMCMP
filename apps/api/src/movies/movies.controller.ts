import { Controller, Get, Query } from "@nestjs/common";
import { MoviesService } from "./movies.service";

@Controller("movies")
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  list(@Query("q") query?: string) {
    return this.movies.list(query);
  }
}
