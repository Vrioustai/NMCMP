import { Module } from "@nestjs/common";
import { CountriesController, GenresController, MoviesController } from "./movies.controller";
import { MoviesService } from "./movies.service";

@Module({
  controllers: [MoviesController, GenresController, CountriesController],
  providers: [MoviesService],
})
export class MoviesModule {}
