import type { RatingSummary, UserProfile } from "@movie/contracts";
import { Body, Controller, Param, ParseIntPipe, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { RateMovieDto } from "./ratings.dto";
import { RatingsService } from "./ratings.service";

@Controller("movies")
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Put(":id/rating")
  rate(
    @CurrentUser() user: UserProfile,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RateMovieDto,
  ): Promise<RatingSummary> {
    return this.ratings.rate(user.id, id, dto);
  }
}
