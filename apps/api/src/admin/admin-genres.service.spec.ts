import { AppError } from "../common/app-error";
import { AdminGenresService } from "./admin-genres.service";

function harness() {
  const prisma = {
    genre: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    movieGenre: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
  };
  const service = new AdminGenresService(prisma as never);
  return { service, prisma };
}

describe("AdminGenresService", () => {
  it("counts movies for every genre with one groupBy", async () => {
    const { service, prisma } = harness();
    prisma.genre.findMany.mockResolvedValue([
      { id: 1, name: "Hài" },
      { id: 2, name: "Hành động" },
    ]);
    prisma.movieGenre.groupBy.mockResolvedValue([{ genreId: 2, _count: 3 }]);

    await expect(service.list()).resolves.toEqual([
      { id: 1, name: "Hài", movieCount: 0 },
      { id: 2, name: "Hành động", movieCount: 3 },
    ]);
    expect(prisma.movieGenre.groupBy).toHaveBeenCalledTimes(1);
  });

  it("rejects a name that already exists regardless of letter case", async () => {
    const { service, prisma } = harness();
    prisma.genre.findFirst.mockResolvedValue({ id: 1 });

    await expect(service.create({ name: "hài" })).rejects.toMatchObject({ code: "GENRE_TAKEN" });
    expect(prisma.genre.create).not.toHaveBeenCalled();
    expect(prisma.genre.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { equals: "hài", mode: "insensitive" } },
      }),
    );
  });

  it("keeps the current name when a patch is empty", async () => {
    const { service, prisma } = harness();
    prisma.genre.findUnique.mockResolvedValue({ id: 4, name: "Kinh dị" });
    prisma.movieGenre.count.mockResolvedValue(2);

    await expect(service.update(4, {})).resolves.toEqual({
      id: 4,
      name: "Kinh dị",
      movieCount: 2,
    });
    expect(prisma.genre.update).not.toHaveBeenCalled();
  });

  it("renames a genre and deletes it when no movie uses it", async () => {
    const { service, prisma } = harness();
    prisma.genre.findFirst.mockResolvedValue(null);
    prisma.genre.create.mockResolvedValue({ id: 5, name: "Kinh dị" });
    await expect(service.create({ name: "Kinh dị" })).resolves.toEqual({
      id: 5,
      name: "Kinh dị",
      movieCount: 0,
    });

    prisma.genre.findUnique.mockResolvedValue({ id: 5, name: "Kinh dị" });
    prisma.genre.update.mockResolvedValue({ id: 5, name: "kinh dị" });
    prisma.movieGenre.count.mockResolvedValue(0);
    await expect(service.update(5, { name: "kinh dị" })).resolves.toMatchObject({
      name: "kinh dị",
      movieCount: 0,
    });
    expect(prisma.genre.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          name: { equals: "kinh dị", mode: "insensitive" },
          id: { not: 5 },
        },
      }),
    );

    await service.remove(5);
    expect(prisma.genre.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("does not delete a genre that is attached to a movie", async () => {
    const { service, prisma } = harness();
    prisma.genre.findUnique.mockResolvedValue({ id: 4, name: "Kinh dị" });
    prisma.movieGenre.count.mockResolvedValue(1);

    await expect(service.remove(4)).rejects.toBeInstanceOf(AppError);
    await expect(service.remove(4)).rejects.toMatchObject({ code: "GENRE_IN_USE" });
    expect(prisma.genre.delete).not.toHaveBeenCalled();
  });
});
