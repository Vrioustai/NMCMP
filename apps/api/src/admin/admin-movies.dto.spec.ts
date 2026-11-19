import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateMovieDto, UpdateMovieDto } from "./admin-movies.dto";

const options = { whitelist: true, forbidNonWhitelisted: true };

const valid = {
  title: "  Phim Mẫu  ",
  slug: "phim-mau",
  description: "Mô tả đủ dùng",
  type: "MOVIE",
  releaseYear: 2024,
  ageRating: "T13",
  genreIds: [1, 2],
  sourceUrl: "https://example.com/phim",
  license: "Demo",
};

describe("CreateMovieDto", () => {
  it("trims text and accepts the required movie fields", async () => {
    const dto = plainToInstance(CreateMovieDto, valid);
    expect(await validate(dto, options)).toHaveLength(0);
    expect(dto.title).toBe("Phim Mẫu");
  });

  it("rejects a reserved slug, a short slug, and a missing genre", async () => {
    for (const slug of ["home", "trending", "Phim", "phim_mau"]) {
      const dto = plainToInstance(CreateMovieDto, { ...valid, slug });
      const fields = (await validate(dto, options)).map((error) => error.property);
      expect(fields).toContain("slug");
    }
    const missing = plainToInstance(CreateMovieDto, { ...valid, genreIds: [] });
    expect((await validate(missing, options)).map((error) => error.property)).toContain("genreIds");
  });

  it("rejects posterUrl and status on the create body", async () => {
    const dto = plainToInstance(CreateMovieDto, {
      ...valid,
      posterUrl: "/media/a.webp",
      status: "PUBLISHED",
    });
    const fields = (await validate(dto, options)).map((error) => error.property);
    expect(fields).toEqual(expect.arrayContaining(["posterUrl", "status"]));
  });
});

describe("UpdateMovieDto", () => {
  it("accepts a title-only patch and a null trailer", async () => {
    const titled = plainToInstance(UpdateMovieDto, { title: "  Tên mới  " });
    const cleared = plainToInstance(UpdateMovieDto, { trailerUrl: null });
    expect(await validate(titled, options)).toHaveLength(0);
    expect(await validate(cleared, options)).toHaveLength(0);
    expect(titled.title).toBe("Tên mới");
    expect(cleared.trailerUrl).toBeNull();
  });

  it("rejects an empty genre list and a null title", async () => {
    const genres = plainToInstance(UpdateMovieDto, { genreIds: [] });
    const title = plainToInstance(UpdateMovieDto, { title: null });
    expect((await validate(genres, options)).map((error) => error.property)).toContain("genreIds");
    expect((await validate(title, options)).map((error) => error.property)).toContain("title");
  });
});
