import { Suspense } from "react";
import { UserList } from "../../../components/admin/user-list";

export const metadata = { title: "Người dùng" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <UserList />
    </Suspense>
  );
}
