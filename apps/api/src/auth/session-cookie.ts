export const SESSION_COOKIE = "fgz_session";

type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

type CookieResponse = {
  cookie(name: string, value: string, options: SessionCookieOptions): void;
  clearCookie(name: string, options: SessionCookieOptions): void;
};

// Không đặt Domain: cookie đi theo đúng máy chủ đang trả lời.
export function sessionCookieOptions(secure: boolean, maxAgeMs: number): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function writeSessionCookie(
  res: CookieResponse,
  token: string,
  secure: boolean,
  maxAgeMs: number,
): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(secure, maxAgeMs));
}

export function clearSessionCookie(res: CookieResponse, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions(secure, 0));
}
