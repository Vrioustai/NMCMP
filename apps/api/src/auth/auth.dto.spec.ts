import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./auth.dto";

const PASSWORD = "MatKhau1";

describe("auth DTOs", () => {
  it("normalizes the register payload and accepts a strong password", async () => {
    const dto = plainToInstance(RegisterDto, {
      email: "  Nguoi@Mail.COM ",
      password: PASSWORD,
      displayName: "  An  ",
      birthYear: 2000,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe("nguoi@mail.com");
    expect(dto.displayName).toBe("An");
  });

  it("rejects a short name, a weak password, and a year before 1900", async () => {
    const dto = plainToInstance(RegisterDto, {
      email: "nguoi@mail.com",
      password: "matkhau",
      displayName: " A ",
      birthYear: 1899,
    });
    const fields = (await validate(dto)).map((error) => error.property);
    expect(fields).toEqual(expect.arrayContaining(["password", "displayName", "birthYear"]));
  });

  it("normalizes the forgot-password email and accepts a new password", async () => {
    const forgot = plainToInstance(ForgotPasswordDto, { email: " Nguoi@Mail.COM " });
    const reset = plainToInstance(ResetPasswordDto, { token: "ma", newPassword: "MatKhau2" });
    expect(await validate(forgot)).toHaveLength(0);
    expect(await validate(reset)).toHaveLength(0);
    expect(forgot.email).toBe("nguoi@mail.com");
  });

  it("rejects a weak replacement password", async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: "ma", newPassword: "matkhau" });
    const fields = (await validate(dto)).map((error) => error.property);
    expect(fields).toContain("newPassword");
  });

  it("normalizes the login email", async () => {
    const dto = plainToInstance(LoginDto, { email: " Nguoi@Mail.COM ", password: PASSWORD });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe("nguoi@mail.com");
  });
});
