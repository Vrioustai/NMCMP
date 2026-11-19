import { Module } from "@nestjs/common";
import { FavoriteLibraryController, FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

@Module({
  controllers: [FavoritesController, FavoriteLibraryController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
