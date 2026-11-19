import { AdminFrame } from "../../components/layout/admin-frame";
import { getSession, isAccountLocked } from "../../lib/get-session";

export const metadata = {
  title: "Quản trị",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (await isAccountLocked()) return null;
  if (!user || user.role !== "ADMIN") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
        <h1 className="text-2xl font-extrabold">Không có quyền</h1>
        <p className="mt-2 text-sm text-muted">Bạn không có quyền vào trang quản trị.</p>
      </main>
    );
  }
  return <AdminFrame>{children}</AdminFrame>;
}
