import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateGenreDto, UpdateGenreDto } from "./admin-genres.dto";

const options = { whitelist: true, forbidNonWhitelisted: true };

describe("genre name", () => {
  it("trims a genre name", async () => {
    const dto = plainToInstance(CreateGenreDto, { name: "  Hài  " });
    expect(await validate(dto, options)).toHaveLength(0);
    expect(dto.name).toBe("Hài");
  });

  it("rejects an empty name and a field that is not allowed", async () => {
    const empty = plainToInstance(CreateGenreDto, { name: "   " });
    expect((await validate(empty, options)).map((error) => error.property)).toContain("name");

    const extra = plainToInstance(UpdateGenreDto, { description: "thừa" });
    expect((await validate(extra, options)).map((error) => error.property)).toContain(
      "description",
    );
  });
});
