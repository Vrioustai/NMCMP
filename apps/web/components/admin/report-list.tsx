"use client";

import type { AdminReport, AdminReportList, ModerationDecision } from "@movie/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { errorMessage } from "../../lib/error-messages";
import { formatDuration, formatNumber } from "../../lib/format";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { Pagination } from "../ui/pagination";
import { Tabs } from "../ui/tabs";

const ACTIONS: { decision: ModerationDecision; label: string; variant: "secondary" | "danger" }[] =
  [
    { decision: "HIDE", label: "Ẩn", variant: "secondary" },
    { decision: "WARN", label: "Cảnh cáo", variant: "secondary" },
    { decision: "DELETE", label: "Xóa", variant: "danger" },
    { decision: "REJECT", label: "Bỏ qua", variant: "secondary" },
  ];

export function ReportList() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status") === "HANDLED" ? "HANDLED" : "PENDING";
  const page = positive(params.get("page"));
  const [data, setData] = useState<AdminReportList | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  const replace = useCallback(
    (next: { status?: string; page?: number }) => {
      const query = new URLSearchParams();
      const tab = next.status ?? status;
      const nextPage = next.page ?? page;
      if (tab === "HANDLED") query.set("status", "HANDLED");
      if (nextPage > 1) query.set("page", String(nextPage));
      router.replace(query.size ? `/admin/reports?${query}` : "/admin/reports");
    },
    [page, router, status],
  );

  useEffect(() => {
    let gone = false;
    const query = new URLSearchParams({ page: String(page), status });
    apiClient<AdminReportList>(`/admin/reports?${query}`)
      .then((list) => {
        if (!gone) {
          setData(list);
          setError("");
        }
      })
      .catch((caught) => {
        if (!gone)
          setError(caught instanceof ApiError ? caught.message : "Không tải được báo cáo.");
      });
    return () => {
      gone = true;
    };
  }, [page, reloadKey, status]);

  async function decide(report: AdminReport, decision: ModerationDecision) {
    setBusyId(report.id);
    setError("");
    try {
      await apiClient(`/admin/reports/${report.id}`, { method: "PATCH", body: { decision } });
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    } finally {
      setBusyId(null);
    }
  }

  const counts = data?.counts ?? { pending: 0, handled: 0 };
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize || 24)));

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Kiểm duyệt</h1>
      <Tabs
        value={status}
        onChange={(id) => replace({ status: id, page: 1 })}
        tabs={[
          { id: "PENDING", label: `Chờ xử lý (${counts.pending})` },
          { id: "HANDLED", label: `Đã xử lý (${counts.handled})` },
        ]}
      />
      {error ? (
        <ErrorState title={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          title={
            status === "PENDING" ? "Không có báo cáo nào đang chờ" : "Chưa có báo cáo đã xử lý"
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <>
          <div className="grid gap-3">
            {data.items.map((report) => (
              <ReportItem
                key={report.id}
                report={report}
                pending={status === "PENDING"}
                busy={busyId === report.id}
                onDecide={(decision) => void decide(report, decision)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPage={(next) => replace({ page: next })}
          />
        </>
      ) : null}
    </div>
  );
}

function ReportItem({
  report,
  pending,
  busy,
  onDecide,
}: {
  report: AdminReport;
  pending: boolean;
  busy: boolean;
  onDecide: (decision: ModerationDecision) => void;
}) {
  return (
    <article className="grid gap-2 rounded-card border border-line bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{report.sender.displayName}</p>
        <p className="text-[13px] text-dim">{formatNumber(report.reportCount)} báo cáo</p>
      </div>
      <p className="text-sm">
        {report.movie.title} · Mùa {report.episode.seasonNumber} · Tập {report.episode.number} ·{" "}
        {formatDuration(report.danmaku.timeMs / 1000)}
      </p>
      <p className="text-sm">{report.danmaku.content}</p>
      <p className="text-[13px] text-muted">Lý do: {report.reason}</p>
      {pending ? (
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action.decision}
              variant={action.variant}
              disabled={busy}
              onClick={() => onDecide(action.decision)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{outcome(report)}</p>
      )}
    </article>
  );
}

function outcome(report: AdminReport): string {
  if (report.status === "REJECTED") return "Đã bỏ qua";
  if (report.action === "HIDE") return "Đã ẩn";
  if (report.action === "DELETE") return "Đã xóa";
  if (report.action === "WARN") return "Đã cảnh cáo";
  return "Đã xử lý";
}

function positive(value: string | null): number {
  const parsed = Number(value ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
