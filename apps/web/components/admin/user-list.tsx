"use client";

import type { AdminUser, AdminUserList, UserStatus } from "@movie/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { errorMessage } from "../../lib/error-messages";
import { formatDate, formatNumber, formatTime } from "../../lib/format";
import { useSession } from "../../lib/session";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { Input } from "../ui/input";
import { Pagination } from "../ui/pagination";
import { Tabs } from "../ui/tabs";

export function UserList() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useSession();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const page = positive(params.get("page"));
  const [draft, setDraft] = useState(q);
  const [data, setData] = useState<AdminUserList | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [actionError, setActionError] = useState("");

  const replace = useCallback(
    (next: { q?: string; status?: string; page?: number }) => {
      const query = new URLSearchParams();
      const text = next.q ?? q;
      const tab = next.status ?? status;
      const nextPage = next.page ?? page;
      if (text) query.set("q", text);
      if (tab) query.set("status", tab);
      if (nextPage > 1) query.set("page", String(nextPage));
      router.replace(query.size ? `/admin/users?${query}` : "/admin/users");
    },
    [page, q, router, status],
  );

  useEffect(() => {
    setDraft(q);
  }, [q]);

  useEffect(() => {
    let gone = false;
    const query = new URLSearchParams({ page: String(page) });
    if (q) query.set("q", q);
    if (status === "ACTIVE" || status === "LOCKED") query.set("status", status);
    apiClient<AdminUserList>(`/admin/users?${query}`)
      .then((list) => {
        if (!gone) {
          setData(list);
          setError("");
        }
      })
      .catch((caught) => {
        if (!gone)
          setError(caught instanceof ApiError ? caught.message : "Không tải được danh sách.");
      });
    return () => {
      gone = true;
    };
  }, [page, q, reloadKey, status]);

  const counts = data?.counts ?? { all: 0, active: 0, locked: 0 };
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize || 24)));

  async function applyStatus(user: AdminUser) {
    const next: UserStatus = user.status === "LOCKED" ? "ACTIVE" : "LOCKED";
    setActionError("");
    try {
      await apiClient(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: { status: next },
      });
      setPending(null);
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setPending(null);
      setActionError(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Người dùng</h1>
      <Tabs
        value={status || "ALL"}
        onChange={(id) => replace({ status: id === "ALL" ? "" : id, page: 1 })}
        tabs={[
          { id: "ALL", label: `Tất cả (${counts.all})` },
          { id: "ACTIVE", label: `Hoạt động (${counts.active})` },
          { id: "LOCKED", label: `Đã khóa (${counts.locked})` },
        ]}
      />
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          replace({ q: draft.trim(), page: 1 });
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            label="Tìm theo tên hoặc email"
            name="q"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit">Tìm</Button>
      </form>
      {error ? (
        <ErrorState title={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : null}
      {actionError ? (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      ) : null}
      {data && data.items.length === 0 ? <EmptyState title="Không có người dùng" /> : null}
      {data && data.items.length > 0 ? (
        <>
          <div className="grid gap-3 md:hidden">
            {data.items.map((user) => (
              <UserCard key={user.id} user={user} meId={me?.id ?? null} onAsk={setPending} />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-panel border border-line md:block">
            <table className="w-full min-w-[720px] text-left">
              <thead className="text-[13px] text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">Tài khoản</th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">Vai trò</th>
                  <th className="px-3 py-3 font-semibold">Trạng thái</th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">Ngày tạo</th>
                  <th className="px-3 py-3 font-semibold">Hoạt động cuối</th>
                  <th className="px-3 py-3 font-semibold">Cảnh cáo</th>
                  <th className="px-3 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <UserRow key={user.id} user={user} meId={me?.id ?? null} onAsk={setPending} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPage={(next) => replace({ page: next })}
          />
        </>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.status === "LOCKED" ? "Mở khóa tài khoản" : "Khóa tài khoản"}
        message={
          pending?.status === "LOCKED"
            ? `${pending.displayName} sẽ đăng nhập lại được.`
            : `${pending?.displayName ?? "Người này"} sẽ không đăng nhập được.`
        }
        confirmLabel={pending?.status === "LOCKED" ? "Mở khóa" : "Khóa"}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) void applyStatus(pending);
        }}
      />
    </div>
  );
}

function UserCard({
  user,
  meId,
  onAsk,
}: {
  user: AdminUser;
  meId: number | null;
  onAsk: (user: AdminUser) => void;
}) {
  return (
    <article className="grid gap-2 rounded-card border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.displayName}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <UserStatusBadge status={user.status} />
      </div>
      <p className="text-[13px] text-dim">Vai trò: {roleLabel(user.role)}</p>
      <p className="text-[13px] text-dim">Ngày tạo: {formatDate(user.createdAt)}</p>
      <p className="text-[13px] text-dim">Hoạt động cuối: {lastActive(user.lastActiveAt)}</p>
      <p className="text-sm">Số lần cảnh cáo: {formatNumber(user.warningCount)}</p>
      <LockButton user={user} meId={meId} onAsk={onAsk} />
    </article>
  );
}

function UserRow({
  user,
  meId,
  onAsk,
}: {
  user: AdminUser;
  meId: number | null;
  onAsk: (user: AdminUser) => void;
}) {
  return (
    <tr className="border-t border-line text-sm">
      <td className="px-3 py-3">
        <p className="font-semibold">{user.displayName}</p>
        <p className="text-[13px] text-muted">{user.email}</p>
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">{roleLabel(user.role)}</td>
      <td className="px-3 py-3">
        <UserStatusBadge status={user.status} />
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">{formatDate(user.createdAt)}</td>
      <td className="px-3 py-3">{lastActive(user.lastActiveAt)}</td>
      <td className="px-3 py-3">{formatNumber(user.warningCount)}</td>
      <td className="px-3 py-3">
        <LockButton user={user} meId={meId} onAsk={onAsk} />
      </td>
    </tr>
  );
}

function LockButton({
  user,
  meId,
  onAsk,
}: {
  user: AdminUser;
  meId: number | null;
  onAsk: (user: AdminUser) => void;
}) {
  const locked = user.status === "LOCKED";
  if (!locked && (user.role === "ADMIN" || user.id === meId)) return null;
  return (
    <Button variant={locked ? "secondary" : "danger"} onClick={() => onAsk(user)}>
      {locked ? "Mở khóa" : "Khóa"}
    </Button>
  );
}

function UserStatusBadge({ status }: { status: UserStatus }) {
  const locked = status === "LOCKED";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-chip px-2 text-[12px] font-bold ${locked ? "bg-danger text-ink" : "bg-ok text-on-accent"}`}
    >
      {locked ? "Đã khóa" : "Hoạt động"}
    </span>
  );
}

function roleLabel(role: AdminUser["role"]): string {
  return role === "ADMIN" ? "Quản trị" : "Người xem";
}

function lastActive(value: string | null): string {
  if (!value) return "Chưa xem";
  return `${formatDate(value)} ${formatTime(value)}`;
}

function positive(value: string | null): number {
  const parsed = Number(value ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
