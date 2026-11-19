import { AVATAR_URLS } from "@movie/contracts";
import { UsersService } from "./users.service";

const user = {
  id: 3,
  email: "a@filmgenz.test",
  displayName: "An",
  avatarUrl: AVATAR_URLS[0],
  birthYear: 2000,
  role: "USER" as const,
};

function service() {
  const findUnique = jest.fn().mockResolvedValue(user);
  const update = jest.fn(async ({ data }: { data: Partial<typeof user> }) => ({
    ...user,
    ...data,
  }));
  const users = new UsersService({ user: { findUnique, update } } as never);
  return { users, findUnique, update };
}

describe("UsersService", () => {
  it("returns the stored profile", async () => {
    const { users } = service();
    await expect(users.get(3)).resolves.toMatchObject({
      displayName: "An",
      avatarUrl: AVATAR_URLS[0],
      birthYear: 2000,
    });
  });

  it("changes the display name without writing the avatar", async () => {
    const { users, update } = service();
    const profile = await users.update(3, { displayName: "Bình" });
    expect(update).toHaveBeenCalledWith({ where: { id: 3 }, data: { displayName: "Bình" } });
    expect(profile.displayName).toBe("Bình");
    expect(profile.avatarUrl).toBe(AVATAR_URLS[0]);
    expect(profile.birthYear).toBe(2000);
  });

  it("changes the avatar without writing the display name", async () => {
    const { users, update } = service();
    const profile = await users.update(3, { avatarUrl: AVATAR_URLS[4] });
    expect(update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { avatarUrl: AVATAR_URLS[4] },
    });
    expect(profile.displayName).toBe("An");
  });

  it("clears the avatar when null is sent and leaves the name", async () => {
    const { users, update } = service();
    const profile = await users.update(3, { avatarUrl: null });
    expect(update).toHaveBeenCalledWith({ where: { id: 3 }, data: { avatarUrl: null } });
    expect(profile.displayName).toBe("An");
    expect(profile.avatarUrl).toBeNull();
  });

  it("does not write when the body changes nothing", async () => {
    const { users, findUnique, update } = service();
    const profile = await users.update(3, {});
    expect(update).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(profile).toMatchObject({ displayName: "An", avatarUrl: AVATAR_URLS[0] });
  });

  it("rejects an avatar outside the list before writing", async () => {
    const { users, update } = service();
    await expect(users.update(3, { avatarUrl: "/avatars/avatar-99.webp" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports a missing user", async () => {
    const { users, findUnique } = service();
    findUnique.mockResolvedValue(null);
    await expect(users.get(9)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(users.update(9, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
