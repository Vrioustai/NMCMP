import type { Metadata } from "next";
import { ClearLockedSession } from "../components/auth/clear-locked-session";
import { ToastProvider } from "../components/ui/toast";
import { getSession, isAccountLocked } from "../lib/get-session";
import { beVietnam } from "../lib/font";
import { SessionProvider } from "../lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FilmGenZ", template: "%s · FilmGenZ" },
  description: "Xem phim và gửi bình luận trên khung hình.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSession();
  const locked = await isAccountLocked();
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="font-sans antialiased">
        <SessionProvider user={user}>
          <ToastProvider>
            {locked ? <ClearLockedSession /> : null}
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
