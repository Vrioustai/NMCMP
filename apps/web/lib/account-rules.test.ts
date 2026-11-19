import {
  birthYearError,
  confirmPasswordError,
  displayNameError,
  emailError,
  loginPasswordError,
  passwordError,
} from "./account-rules";

const PASSWORD = "MatKhau1";

describe("account rules", () => {
  it("accepts a normal email, name, year, and password", () => {
    expect(emailError("  Nguoi@Mail.com ")).toBeUndefined();
    expect(displayNameError("  An  ")).toBeUndefined();
    expect(birthYearError("2000", 2026)).toBeUndefined();
    expect(passwordError(PASSWORD)).toBeUndefined();
    expect(loginPasswordError(PASSWORD)).toBeUndefined();
    expect(confirmPasswordError(PASSWORD, PASSWORD)).toBeUndefined();
  });

  it("rejects a short name, a weak password, a future year, and a mismatched confirmation", () => {
    expect(displayNameError(" A ")).toBe("Tên hiển thị cần từ 2 ký tự");
    expect(passwordError("matkhau1")).toBe("Mật khẩu cần chữ hoa, chữ thường và chữ số");
    expect(passwordError("Ngan")).toBe("Mật khẩu cần từ 8 ký tự");
    expect(birthYearError("1899", 2026)).toBe("Năm sinh không hợp lệ");
    expect(birthYearError("2027", 2026)).toBe("Năm sinh không hợp lệ");
    expect(confirmPasswordError(PASSWORD, "MatKhau2")).toBe("Mật khẩu nhập lại chưa khớp");
    expect(loginPasswordError("")).toBe("Thiếu mật khẩu");
    expect(emailError("khong-phai-email")).toBe("Email không hợp lệ");
  });
});
