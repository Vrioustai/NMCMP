import type { AdminMovie } from "@movie/contracts";
import Link from "next/link";
import { MissingVideoBadge, StatusBadge, missingVideo } from "./status-badge";

function Actions({ movie }: { movie: AdminMovie }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/movies/${movie.id}`} className="text-sm font-semibold text-accent">
        Sửa
      </Link>
      {movie.status === "PUBLISHED" ? (
        <Link href={`/movies/${movie.slug}`} className="text-sm text-ink">
          Xem
        </Link>
      ) : null}
    </div>
  );
}

export function MovieRow({ movie }: { movie: AdminMovie }) {
  const missing = missingVideo(movie);
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3">
        <div className="font-semibold">{movie.title}</div>
        <div className="text-[13px] text-muted">{movie.slug}</div>
      </td>
      <td className="hidden px-3 py-3 text-sm lg:table-cell">{movie.releaseYear}</td>
      <td className="px-3 py-3">
        <StatusBadge status={movie.status} />
      </td>
      <td className="px-3 py-3">{missing ? <MissingVideoBadge /> : null}</td>
      <td className="hidden px-3 py-3 text-sm text-muted lg:table-cell">
        {movie.episodesWithStream}/{movie.episodeCount}
      </td>
      <td className="px-3 py-3">
        <Actions movie={movie} />
      </td>
    </tr>
  );
}

export function MovieCard({ movie }: { movie: AdminMovie }) {
  return (
    <article className="rounded-panel border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{movie.title}</h2>
          <p className="text-[13px] text-muted">{movie.slug}</p>
        </div>
        <StatusBadge status={movie.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {missingVideo(movie) ? <MissingVideoBadge /> : null}
        <span className="text-[13px] text-muted">
          {movie.episodesWithStream}/{movie.episodeCount} tập có video
        </span>
      </div>
      <div className="mt-3">
        <Actions movie={movie} />
      </div>
    </article>
  );
}
