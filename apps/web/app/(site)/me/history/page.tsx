import type { Page, WatchHistoryItem } from "@movie/contracts";
import Image from "next/image";
import Link from "next/link";
import { MePager, pageNumber } from "../../../../components/account/me-pager";
import { EmptyState } from "../../../../components/ui/empty-state";
import { apiServer } from "../../../../lib/api/server";
import { formatDate, formatDuration, formatTime } from "../../../../lib/format";
import { progressPercent } from "../../../../lib/history-progress";

export const metadata = { title: "Lịch sử xem" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const data = await apiServer<Page<WatchHistoryItem>>(`/me/history?page=${page}`, {
    redirectOn401: "/me/history",
  });

  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">Lịch sử xem</h1>
      {data.items.length === 0 ? (
        <EmptyState title="Bạn chưa xem phim nào" />
      ) : (
        <ul className="grid gap-3">
          {data.items.map((item) => (
            <li key={item.movie.id}>
              <HistoryRow item={item} />
            </li>
          ))}
        </ul>
      )}
      <MePager base="/me/history" page={data.page} pageSize={data.pageSize} total={data.total} />
    </>
  );
}

function HistoryRow({ item }: { item: WatchHistoryItem }) {
  const percent = progressPercent(item.progressSec, item.episode.durationSec);
  const when = `${formatDate(item.watchedAt)} ${formatTime(item.watchedAt)}`;
  return (
    <Link
      href={`/movies/${item.movie.slug}`}
      className="flex gap-3 rounded-card bg-raised p-3"
    >
      <span className="relative h-24 w-16 shrink-0 overflow-hidden rounded-card bg-bg">
        {item.movie.posterUrl ? (
          <Image src={item.movie.posterUrl} alt="" fill sizes="64px" className="object-cover" />
        ) : null}
      </span>
      <span className="grid min-w-0 flex-1 content-start gap-1">
        <span className="truncate font-semibold">{item.movie.title}</span>
        <span className="text-sm text-muted">{episodeLine(item)}</span>
        {percent === null ? null : (
          <span
            className="mt-1 block h-1 overflow-hidden rounded-pill bg-bg"
            role="progressbar"
            aria-label="Tiến độ"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
          </span>
        )}
        <span className="text-[13px] text-dim">
          Đã xem {formatDuration(item.progressSec)} · {when}
        </span>
      </span>
    </Link>
  );
}

function episodeLine(item: WatchHistoryItem): string {
  const episode = item.episode;
  if (item.movie.type === "SERIES") {
    return `Mùa ${episode.seasonNumber} · Tập ${episode.number}`;
  }
  return episode.title ? episode.title : `Tập ${episode.number}`;
}
