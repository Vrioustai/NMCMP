import { Suspense } from "react";
import { StatsBoard } from "../../components/admin/stats-board";

export const metadata = { title: "Bảng điều khiển" };

export default function AdminHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <StatsBoard />
    </Suspense>
  );
}
