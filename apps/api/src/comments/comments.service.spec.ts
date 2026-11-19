import type { UserProfile } from "@movie/contracts";
import type { PrismaService } from "../prisma/prisma.service";
import { CommentsService } from "./comments.service";

const viewer: UserProfile = {
  id: 4,
  email: "binh@filmgenz.test",
  displayName: "Bình",
  avatarUrl: "/avatars/avatar-01.webp",
  birthYear: 2000,
  role: "USER",
};

const published = { id: 6, status: "PUBLISHED" };

function service(findFirst: jest.Mock, comment: Record<string, jest.Mock>) {
  return new CommentsService({
    movie: { findFirst },
    comment,
  } as unknown as PrismaService);
}

describe("CommentsService", () => {
  it("lists the newest comment first and stores plain text", async () => {
    const findFirst = jest.fn().mockResolvedValue(published);
    const count = jest.fn().mockResolvedValue(1);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 2,
        content: "mới",
        createdAt: new Date("2026-06-15T04:00:00.000Z"),
        user: { displayName: "Bình", avatarUrl: null },
      },
    ]);
    const create = jest.fn().mockResolvedValue({
      id: 9,
      content: "hay quá",
      createdAt: new Date("2026-06-15T05:00:00.000Z"),
    });
    const comments = service(findFirst, { count, findMany, create });

    await expect(comments.list(6, { page: 1, pageSize: 10 })).resolves.toMatchObject({
      total: 1,
      items: [{ id: 2, content: "mới", user: { displayName: "Bình" } }],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    );

    await expect(comments.create(viewer, 6, { content: "  hay quá  " })).resolves.toMatchObject({
      id: 9,
      content: "hay quá",
      user: { displayName: "Bình", avatarUrl: "/avatars/avatar-01.webp" },
    });
    expect(create).toHaveBeenCalledWith({
      data: { movieId: 6, userId: 4, content: "hay quá" },
    });
  });

  it("hides a draft and rejects an empty comment", async () => {
    const create = jest.fn();
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 6, status: "PUBLISHED" });
    const comments = service(findFirst, { create });
    await expect(comments.list(6, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(comments.create(viewer, 6, { content: "\u0001" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(create).not.toHaveBeenCalled();
  });
});
