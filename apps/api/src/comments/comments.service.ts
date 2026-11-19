import {
  COMMENT_MAX_LENGTH,
  type CommentItem,
  type Page,
  type UserProfile,
} from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { requirePublishedMovie } from "../catalog/catalog-access";
import { AppError } from "../common/app-error";
import { pageQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import type { CommentQueryDto, CreateCommentDto } from "./comments.dto";

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(movieId: number, query: CommentQueryDto): Promise<Page<CommentItem>> {
    const movie = await requirePublishedMovie(this.prisma, { id: movieId });
    const page = pageQuery(query);
    const where = { movieId: movie.id };
    const [total, rows] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: page.skip,
        take: page.take,
        include: { user: { select: { displayName: true, avatarUrl: true } } },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        user: { displayName: row.user.displayName, avatarUrl: row.user.avatarUrl },
      })),
      page: page.page,
      pageSize: page.pageSize,
      total,
    };
  }

  async create(user: UserProfile, movieId: number, dto: CreateCommentDto): Promise<CommentItem> {
    const movie = await requirePublishedMovie(this.prisma, { id: movieId });
    const content = cleanComment(dto.content);
    const row = await this.prisma.comment.create({
      data: { movieId: movie.id, userId: user.id, content },
    });
    return {
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      user: { displayName: user.displayName, avatarUrl: user.avatarUrl },
    };
  }
}

function cleanComment(value: string): string {
  const content = value
    .normalize("NFC")
    .replace(/\p{Cc}/gu, "")
    .trim();
  const length = Array.from(content).length;
  if (length < 1 || length > COMMENT_MAX_LENGTH) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "content", message: "Bình luận cần từ 1 đến 1.000 ký tự" },
    ]);
  }
  return content;
}
