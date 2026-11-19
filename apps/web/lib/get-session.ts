import { cookies } from "next/headers";
import { cache } from "react";
import { ApiError } from "./api/errors";
import { apiServer } from "./api/server";
import type { UserProfile } from "./api/types";

type SessionState = { user: UserProfile | null; locked: boolean };

// Không có cookie thì là khách, không gọi API.
// 401 và 404 là khách. Tài khoản bị khóa không hiện như đã đăng nhập.
const loadSession = cache(async (): Promise<SessionState> => {
  const jar = await cookies();
  if (!jar.get("fgz_session")) return { user: null, locked: false };
  try {
    return { user: await apiServer<UserProfile>("/me", { notFoundOn404: false }), locked: false };
  } catch (error) {
    if (error instanceof ApiError && error.code === "ACCOUNT_LOCKED") {
      return { user: null, locked: true };
    }
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return { user: null, locked: false };
    }
    throw error;
  }
});

export const getSession = cache(async (): Promise<UserProfile | null> => {
  return (await loadSession()).user;
});

export const isAccountLocked = cache(async (): Promise<boolean> => {
  return (await loadSession()).locked;
});
