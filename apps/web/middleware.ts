import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "./lib/safe-next";

// Chỉ xem cookie có mặt hay không. Nội dung cookie không được đọc ở middleware.
export function middleware(request: NextRequest) {
  if (request.cookies.get("fgz_session")) return NextResponse.next();
  const next = safeNext(request.nextUrl.pathname + request.nextUrl.search, request.nextUrl.origin);
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/me", "/me/:path*", "/watch", "/watch/:path*", "/admin", "/admin/:path*"],
};
