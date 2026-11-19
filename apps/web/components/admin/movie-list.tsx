"use client";

import type { AdminMovieList } from "@movie/contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../lib/api/errors";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { Input } from "../ui/input";
import { Pagination } from "../ui/pagination";
import { Tabs } from "../ui/tabs";
import { MovieCard, MovieRow } from "./movie-row";

export function MovieList() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const page = positive(params.get("page"));
  const [draft, setDraft] = useState(q);
  const [data, setData] = useState<AdminMovieList | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const replace = useCallback(
    (next: { q?: string; status?: string; page?: number }) => {
      const query = new URLSearchParams();
      const text = next.q ?? q;
      const tab = next.status ?? status;
      const nextPage = next.page ?? page;
      if (text) query.set("q", text);
      if (tab) query.set("status", tab);
      if (nextPage > 1) query.set("page", String(nextPage));
      router.replace(query.size ? `/admin/movies?${query}` : "/admin/movies");
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
    if (status === "DRAFT" || status === "PUBLISHED") query.set("status", status);
    apiClient<AdminMovieList>(`/admin/movies?${query}`)
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

  const counts = data?.counts ?? { all: 0, draft: 0, published: 0 };
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize || 24)));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Phim</h1>
        <Link
          href="/admin/movies/new"
          className="inline-flex h-10 items-center rounded-control bg-linear-to-r from-accent to-accent-2 px-4 text-sm font-semibold text-on-accent"
        >
          Thêm phim
        </Link>
      </div>
      <Tabs
        value={status || "ALL"}
        onChange={(id) => replace({ status: id === "ALL" ? "" : id, page: 1 })}
        tabs={[
          { id: "ALL", label: `Tất cả (${counts.all})` },
          { id: "PUBLISHED", label: `Công khai (${counts.published})` },
          { id: "DRAFT", label: `Nháp (${counts.draft})` },
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
            label="Tìm theo tên hoặc slug"
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
      {data && data.items.length === 0 ? (
        <EmptyState title="Chưa có phim" description="Thêm phim mới để bắt đầu." />
      ) : null}
      {data && data.items.length > 0 ? (
        <>
          <div className="grid gap-3 md:hidden">
            {data.items.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-panel border border-line md:block">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-[13px] text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">Phim</th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">Năm</th>
                  <th className="px-3 py-3 font-semibold">Trạng thái</th>
                  <th className="px-3 py-3 font-semibold">Video</th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">Tập</th>
                  <th className="px-3 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((movie) => (
                  <MovieRow key={movie.id} movie={movie} />
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
    </div>
  );
}

function positive(value: string | null): number {
  const parsed = Number(value ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
