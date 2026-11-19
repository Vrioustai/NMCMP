import { BIRTH_YEAR_MIN, type UserProfile } from "@movie/contracts";
import { AppError } from "../common/app-error";

type UserRow = {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  birthYear: number;
  role: UserProfile["role"];
};

export function toProfile(user: UserRow): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    birthYear: user.birthYear,
    role: user.role,
  };
}

export function assertBirthYear(year: number, currentYear: number): void {
  if (year < BIRTH_YEAR_MIN || year > currentYear) {
    throw new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", [
      { field: "birthYear", message: "Năm sinh không hợp lệ" },
    ]);
  }
}
