import { AVATAR_URLS } from "@movie/contracts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateProfileDto } from "./users.dto";

const options = { whitelist: true, forbidNonWhitelisted: true };

describe("UpdateProfileDto", () => {
  it("trims the display name and accepts a listed avatar or null", async () => {
    const named = plainToInstance(UpdateProfileDto, { displayName: "  Bình  " });
    const pictured = plainToInstance(UpdateProfileDto, { avatarUrl: AVATAR_URLS[0] });
    const cleared = plainToInstance(UpdateProfileDto, { avatarUrl: null });
    expect(await validate(named, options)).toHaveLength(0);
    expect(await validate(pictured, options)).toHaveLength(0);
    expect(await validate(cleared, options)).toHaveLength(0);
    expect(named.displayName).toBe("Bình");
    expect(cleared.avatarUrl).toBeNull();
  });

  it("rejects a short name, a null name, and an avatar outside the list", async () => {
    const short = plainToInstance(UpdateProfileDto, { displayName: " A " });
    const empty = plainToInstance(UpdateProfileDto, { displayName: null });
    const outside = plainToInstance(UpdateProfileDto, { avatarUrl: "/avatars/avatar-13.webp" });
    expect((await validate(short, options)).map((error) => error.property)).toContain(
      "displayName",
    );
    expect((await validate(empty, options)).map((error) => error.property)).toContain(
      "displayName",
    );
    expect((await validate(outside, options)).map((error) => error.property)).toContain(
      "avatarUrl",
    );
  });

  it("rejects birthYear, email, and role", async () => {
    const extras = [{ birthYear: 2000 }, { email: "a@b.c" }, { role: "ADMIN" }];
    for (const extra of extras) {
      const dto = plainToInstance(UpdateProfileDto, { displayName: "Bình", ...extra });
      const fields = (await validate(dto, options)).map((error) => error.property);
      expect(fields).toContain(Object.keys(extra)[0]);
    }
  });
});
