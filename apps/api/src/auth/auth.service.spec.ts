import { AppError } from "../common/app-error";
import { Clock } from "../common/clock";
import { AuthService } from "./auth.service";
import type { ForgotPasswordDto, ResetPasswordDto } from "./auth.dto";
import { hashResetToken } from "./reset-token";
import type { LoginDto, RegisterDto } from "./auth.dto";

jest.mock("argon2", () => ({
  __esModule: true,
  default: {
    argon2id: 2,
    hash: jest.fn(async (password: string) => `$argon2id$mock$${password}`),
    verify: jest.fn(
      async (hash: string, password: string) => hash === `$argon2id$mock$${password}`,
    ),
  },
}));

const PASSWORD = "MatKhau1";

function service() {
  const create = jest.fn();
  const findUnique = jest.fn();
  const sign = jest.fn().mockReturnValue("token.chu.ky");
  const config = {
    getOrThrow: (key: string) => {
      if (key === "COOKIE_SECURE") return false;
      if (key === "TZ_APP") return "Asia/Ho_Chi_Minh";
      if (key === "SESSION_TTL_DAYS") return 7;
      throw new Error(key);
    },
  };
  const auth = new AuthService(
    { user: { create, findUnique } } as never,
    { sign } as never,
    config as never,
    { sendPasswordReset: jest.fn() } as never,
  );
  return { auth, create, findUnique, sign };
}

describe("AuthService", () => {
  it("registers a user and signs a session from the new hash", async () => {
    const { auth, create, sign } = service();
    await auth.onModuleInit();
    create.mockImplementation(async ({ data }: { data: { passwordHash: string } }) => ({
      id: 4,
      email: "nguoi@mail.com",
      displayName: "An",
      avatarUrl: null,
      birthYear: 2000,
      role: "USER",
      passwordHash: data.passwordHash,
    }));

    const issued = await auth.register({
      email: "nguoi@mail.com",
      password: PASSWORD,
      displayName: "An",
      birthYear: 2000,
    } as RegisterDto);

    expect(issued.profile).toEqual({
      id: 4,
      email: "nguoi@mail.com",
      displayName: "An",
      avatarUrl: null,
      birthYear: 2000,
      role: "USER",
    });
    expect(issued.profile).not.toHaveProperty("passwordHash");
    expect(sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 4, pv: expect.any(String) }));
    expect(create.mock.calls[0][0].data.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("rejects a birth year after the current year", async () => {
    const { auth } = service();
    await auth.onModuleInit();
    await expect(
      auth.register({
        email: "nguoi@mail.com",
        password: PASSWORD,
        displayName: "An",
        birthYear: 2099,
      } as RegisterDto),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("returns the same credential error when the email is missing or the password is wrong", async () => {
    const { auth, findUnique } = service();
    await auth.onModuleInit();
    findUnique.mockResolvedValue(null);
    await expect(
      auth.login({ email: "khong@mail.com", password: PASSWORD } as LoginDto),
    ).rejects.toBeInstanceOf(AppError);

    findUnique.mockResolvedValue({
      id: 4,
      email: "nguoi@mail.com",
      displayName: "An",
      avatarUrl: null,
      birthYear: 2000,
      role: "USER",
      status: "ACTIVE",
      passwordHash: "$argon2id$mock$MatKhauKhac",
    });
    await expect(
      auth.login({ email: "nguoi@mail.com", password: PASSWORD } as LoginDto),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("rejects a locked account only after the password matches", async () => {
    const { auth, findUnique } = service();
    await auth.onModuleInit();
    findUnique.mockResolvedValue({
      id: 4,
      email: "nguoi@mail.com",
      displayName: "An",
      avatarUrl: null,
      birthYear: 2000,
      role: "USER",
      status: "LOCKED",
      passwordHash: `$argon2id$mock$${PASSWORD}`,
    });
    await expect(
      auth.login({ email: "nguoi@mail.com", password: "SaiMatKhau1" } as LoginDto),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      auth.login({ email: "nguoi@mail.com", password: PASSWORD } as LoginDto),
    ).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
    });
  });

  it("writes and clears the session cookie without a Domain attribute", async () => {
    const { auth } = service();
    await auth.onModuleInit();
    const writes: unknown[][] = [];
    const clears: unknown[][] = [];
    const res = {
      cookie: (...args: unknown[]) => writes.push(args),
      clearCookie: (...args: unknown[]) => clears.push(args),
    };
    auth.writeSession(res, "token");
    auth.clearSession(res);
    expect(writes[0]?.[0]).toBe("fgz_session");
    expect(writes[0]?.[2]).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(writes[0]?.[2]).not.toHaveProperty("domain");
    expect(clears[0]?.[0]).toBe("fgz_session");
  });

  it("logs in an active account", async () => {
    const { auth, findUnique } = service();
    await auth.onModuleInit();
    findUnique.mockResolvedValue({
      id: 4,
      email: "nguoi@mail.com",
      displayName: "An",
      avatarUrl: null,
      birthYear: 2000,
      role: "USER",
      status: "ACTIVE",
      passwordHash: `$argon2id$mock$${PASSWORD}`,
    });
    const issued = await auth.login({ email: "nguoi@mail.com", password: PASSWORD } as LoginDto);
    expect(issued.profile.displayName).toBe("An");
    expect(issued.token).toBe("token.chu.ky");
  });
});

function resetService() {
  const findUser = jest.fn();
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const createToken = jest.fn().mockResolvedValue({ id: 1 });
  const findToken = jest.fn();
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const updateUser = jest.fn().mockResolvedValue({});
  const tx = {
    passwordResetToken: { deleteMany, create: createToken, updateMany },
    user: { update: updateUser },
  };
  const sendPasswordReset = jest.fn();
  const config = {
    getOrThrow: (key: string) => {
      if (key === "WEB_ORIGIN") return "http://localhost:3000";
      if (key === "TZ_APP") return "Asia/Ho_Chi_Minh";
      if (key === "COOKIE_SECURE") return false;
      if (key === "SESSION_TTL_DAYS") return 7;
      throw new Error(key);
    },
  };
  const auth = new AuthService(
    {
      user: { findUnique: findUser },
      passwordResetToken: { findUnique: findToken },
      $transaction: async (run: (client: typeof tx) => Promise<void>) => run(tx),
    } as never,
    { sign: jest.fn() } as never,
    config as never,
    { sendPasswordReset } as never,
  );
  return {
    auth,
    findUser,
    deleteMany,
    createToken,
    findToken,
    updateMany,
    updateUser,
    sendPasswordReset,
  };
}

describe("password reset", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("stores only the token hash and queues the mail after the write", async () => {
    const instant = new Date("2026-06-01T03:00:00.000Z");
    jest.spyOn(Clock, "start").mockReturnValue(new Clock(instant));
    const { auth, findUser, deleteMany, createToken, sendPasswordReset } = resetService();
    findUser.mockResolvedValue({ id: 4 });

    await auth.requestPasswordReset({ email: "nguoi@mail.com" } as ForgotPasswordDto);

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 4, usedAt: null } });
    const created = createToken.mock.calls[0][0].data as { tokenHash: string; expiresAt: Date };
    expect(created.expiresAt.getTime() - instant.getTime()).toBe(30 * 60 * 1000);
    const link = sendPasswordReset.mock.calls[0][1] as string;
    const token = new URL(link).searchParams.get("token") ?? "";
    expect(link.startsWith("http://localhost:3000/reset-password?token=")).toBe(true);
    expect(created.tokenHash).toBe(hashResetToken(token));
    expect(created.tokenHash).not.toContain(token);
  });

  it("does nothing visible when the email is unknown", async () => {
    const { auth, findUser, createToken, sendPasswordReset } = resetService();
    findUser.mockResolvedValue(null);
    await auth.requestPasswordReset({ email: "khong@mail.com" } as ForgotPasswordDto);
    expect(createToken).not.toHaveBeenCalled();
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it("changes the password and marks the token used in one transaction", async () => {
    const instant = new Date("2026-06-01T03:00:00.000Z");
    jest.spyOn(Clock, "start").mockReturnValue(new Clock(instant));
    const { auth, findToken, updateMany, updateUser } = resetService();
    findToken.mockResolvedValue({
      id: 9,
      userId: 4,
      usedAt: null,
      expiresAt: new Date(instant.getTime() + 30 * 60 * 1000),
      user: { passwordHash: `$argon2id$mock$${PASSWORD}` },
    });

    await auth.resetPassword({ token: "ma-dat-lai", newPassword: "MatKhau2" } as ResetPasswordDto);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 9, usedAt: null, expiresAt: { gt: instant } },
      data: { usedAt: instant },
    });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { passwordHash: "$argon2id$mock$MatKhau2" },
    });
  });

  it("keeps the token when the new password matches the current one", async () => {
    const instant = new Date("2026-06-01T03:00:00.000Z");
    jest.spyOn(Clock, "start").mockReturnValue(new Clock(instant));
    const { auth, findToken, updateMany } = resetService();
    findToken.mockResolvedValue({
      id: 9,
      userId: 4,
      usedAt: null,
      expiresAt: new Date(instant.getTime() + 60_000),
      user: { passwordHash: `$argon2id$mock$${PASSWORD}` },
    });
    await expect(
      auth.resetPassword({ token: "ma-dat-lai", newPassword: PASSWORD } as ResetPasswordDto),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects a token at the 30 minute mark and a token already used", async () => {
    const instant = new Date("2026-06-01T03:00:00.000Z");
    jest.spyOn(Clock, "start").mockReturnValue(new Clock(instant));
    const { auth, findToken, updateMany } = resetService();
    findToken.mockResolvedValue({
      id: 9,
      userId: 4,
      usedAt: null,
      expiresAt: new Date(instant.getTime() + 30 * 60 * 1000),
      user: { passwordHash: `$argon2id$mock$${PASSWORD}` },
    });
    instant.setTime(instant.getTime() + 30 * 60 * 1000);
    await expect(
      auth.resetPassword({ token: "ma-dat-lai", newPassword: "MatKhau2" } as ResetPasswordDto),
    ).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });

    instant.setTime(instant.getTime() - 60_000);
    findToken.mockResolvedValue({
      id: 9,
      userId: 4,
      usedAt: instant,
      expiresAt: new Date(instant.getTime() + 30 * 60 * 1000),
      user: { passwordHash: `$argon2id$mock$${PASSWORD}` },
    });
    await expect(
      auth.resetPassword({ token: "ma-dat-lai", newPassword: "MatKhau2" } as ResetPasswordDto),
    ).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
