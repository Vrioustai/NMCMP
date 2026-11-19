import type { CommentItem, Page, UserProfile } from "@movie/contracts";
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { CurrentUser, Public } from "../auth/auth.decorators";
import { CommentQueryDto, CreateCommentDto } from "./comments.dto";
import { CommentsService } from "./comments.service";

@Controller("movies")
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Get(":id/comments")
  list(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: CommentQueryDto,
  ): Promise<Page<CommentItem>> {
    return this.comments.list(id, query);
  }

  @Post(":id/comments")
  create(
    @CurrentUser() user: UserProfile,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentItem> {
    return this.comments.create(user, id, dto);
  }
}
