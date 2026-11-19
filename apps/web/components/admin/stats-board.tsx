"use client";

import type { AdminStats, DailyStat } from "@movie/contracts";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { formatNumber } from "../../lib/format";
import { rangeEnding, vietnamDay } from "../../lib/stats-range";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { Input } from "../ui/input";

const PRESETS = [7, 30, 90] as const;

export function StatsBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  useEffect(() => {
    if (from && to) return;
    const range = rangeEnding(vietnamDay(new Date()), 7);
    router.replace(`/admin?from=${range.from}&to=${range.to}`);
  }, [from, router, to]);

  useEffect(() => {
    if (!from || !to) return;
    let gone = false;
    apiClient<AdminStats>(`/admin/stats?from=${from}&to=${to}`)
      .then((stats) => {
        if (!gone) {
          setData(stats);
          setError("");
        }
      })
      .catch((caught) => {
        if (!gone) {
          setData(null);
          setError(caught instanceof ApiError ? caught.message : "Không tải được thống kê.");
        }
      });
    return () => {
      gone = true;
    };
  }, [from, reloadKey, to]);

  function apply(nextFrom: string, nextTo: string) {
    router.replace(`/admin?from=${nextFrom}&to=${nextTo}`);
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Bảng điều khiển</h1>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((days) => (
          <Button
            key={days}
            variant={matchesPreset(from, to, days) ? "primary" : "secondary"}
            onClick={() => {
              const range = rangeEnding(vietnamDay(new Date()), days);
              apply(range.from, range.to);
            }}
          >
            {days} ngày
          </Button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          apply(draftFrom, draftTo);
        }}
      >
        <Input
          label="Từ ngày"
          name="from"
          type="date"
          value={draftFrom}
          onChange={(event) => setDraftFrom(event.target.value)}
        />
        <Input
          label="Đến ngày"
          name="to"
          type="date"
          value={draftTo}
          onChange={(event) => setDraftTo(event.target.value)}
        />
        <Button type="submit">Xem</Button>
      </form>
      {error ? (
        <ErrorState title={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Tài khoản mới" value={data.totals.newUsers} />
            <StatCard label="Lượt xem" value={data.totals.views} />
            <StatCard label="Danmaku" value={data.totals.danmaku} />
            <StatCard label="Báo cáo" value={data.totals.reports} />
          </div>
          <section className="grid gap-2">
            <h2 className="text-lg font-extrabold">Lượt xem theo ngày</h2>
            <DailyChart days={data.days} />
          </section>
          <section className="grid gap-2">
            <h2 className="text-lg font-extrabold">Phim xem nhiều</h2>
            {data.topMovies.length === 0 ? <EmptyState title="Chưa có lượt xem" /> : null}
            {data.topMovies.length > 0 ? (
              <ol className="grid gap-2">
                {data.topMovies.map((movie, index) => (
                  <li key={movie.id}>
                    <Link
                      href={`/movies/${movie.slug}`}
                      className="flex items-center gap-3 rounded-card border border-line bg-card p-3"
                    >
                      <span className="w-6 text-sm font-bold text-muted">{index + 1}</span>
                      <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-card bg-raised">
                        {movie.posterUrl ? (
                          <Image
                            src={movie.posterUrl}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{movie.title}</span>
                        <span className="text-[13px] text-muted">
                          {formatNumber(movie.views)} lượt xem
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-card border border-line bg-card p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="text-2xl font-extrabold">{formatNumber(value)}</p>
    </article>
  );
}

function DailyChart({ days }: { days: DailyStat[] }) {
  const max = Math.max(1, ...days.map((day) => day.views));
  const width = Math.max(days.length * 16, 160);
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-card p-3">
      <svg
        viewBox={`0 0 ${width} 140`}
        className="h-40 min-w-full"
        role="img"
        aria-label="Lượt xem theo ngày"
      >
        {days.map((day, index) => {
          const bar = Math.round((day.views / max) * 100);
          const x = index * 16 + 4;
          return (
            <g key={day.day}>
              <title>
                {`${day.day}: ${day.views} lượt xem, ${day.newUsers} tài khoản mới, ${day.danmaku} Danmaku, ${day.reports} báo cáo`}
              </title>
              <rect x={x} y={112 - bar} width={8} height={bar} rx={2} className="fill-accent" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function matchesPreset(from: string, to: string, days: number): boolean {
  if (!from || !to) return false;
  const range = rangeEnding(vietnamDay(new Date()), days);
  return from === range.from && to === range.to;
}
