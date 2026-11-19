import type { BannedWord, UserProfile } from "@movie/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { CreateBannedWordDto } from "./admin-words.dto";
import { AdminWordsService } from "./admin-words.service";

@Roles("ADMIN")
@Controller("admin/banned-words")
export class AdminWordsController {
  constructor(private readonly words: AdminWordsService) {}

  @Get()
  list(): Promise<BannedWord[]> {
    return this.words.list();
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() actor: UserProfile, @Body() dto: CreateBannedWordDto): Promise<BannedWord> {
    return this.words.create(actor.id, dto.word);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.words.remove(id);
  }
}
