import { Suspense } from "react";
import { ReportList } from "../../../components/admin/report-list";

export const metadata = { title: "Kiểm duyệt" };

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <ReportList />
    </Suspense>
  );
}
