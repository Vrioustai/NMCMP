import type { MovieCard, MovieUserState, Page, UserProfile } from "@movie/contracts";
import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Put, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { FavoritesQueryDto } from "./favorites.dto";
import { FavoritesService } from "./favorites.service";

@Controller("me/movies")
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get(":movieId/state")
  state(
    @CurrentUser() user: UserProfile,
    @Param("movieId", ParseIntPipe) movieId: number,
  ): Promise<MovieUserState> {
    return this.favorites.state(user.id, movieId);
  }
}

@Controller("me/favorites")
export class FavoriteLibraryController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(
    @CurrentUser() user: UserProfile,
    @Query() query: FavoritesQueryDto,
  ): Promise<Page<MovieCard>> {
    return this.favorites.list(user.id, query);
  }

  @Put(":movieId")
  @HttpCode(204)
  add(
    @CurrentUser() user: UserProfile,
    @Param("movieId", ParseIntPipe) movieId: number,
  ): Promise<void> {
    return this.favorites.add(user.id, movieId);
  }

  @Delete(":movieId")
  @HttpCode(204)
  remove(
    @CurrentUser() user: UserProfile,
    @Param("movieId", ParseIntPipe) movieId: number,
  ): Promise<void> {
    return this.favorites.remove(user.id, movieId);
  }
}
