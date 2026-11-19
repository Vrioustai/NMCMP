import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public } from "../auth/auth.decorators";
import { MovieListQueryDto } from "./movies.dto";
import { MoviesService } from "./movies.service";

@Public()
@Controller("movies")
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get("home")
  home() {
    return this.movies.home();
  }

  @Get("trending")
  trending() {
    return this.movies.trending();
  }

  @Get()
  list(@Query() query: MovieListQueryDto) {
    return this.movies.list(query);
  }

  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.movies.detail(slug);
  }
}

@Public()
@Controller("genres")
export class GenresController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  list() {
    return this.movies.genres();
  }
}

@Public()
@Controller("countries")
export class CountriesController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  list() {
    return this.movies.countries();
  }
}
