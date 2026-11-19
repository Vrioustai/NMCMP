import type { AdminMovie, MovieStatus } from "@movie/contracts";

export function missingVideo(
  movie: Pick<AdminMovie, "episodeCount" | "episodesWithStream">,
): boolean {
  return movie.episodeCount === 0 || movie.episodesWithStream < movie.episodeCount;
}

export function StatusBadge({ status }: { status: MovieStatus }) {
  const published = status === "PUBLISHED";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-chip px-2 text-[12px] font-bold ${published ? "bg-accent text-on-accent" : "bg-raised text-ink"}`}
    >
      {published ? "Công khai" : "Nháp"}
    </span>
  );
}

export function MissingVideoBadge() {
  return (
    <span className="inline-flex h-6 items-center rounded-chip bg-danger px-2 text-[12px] font-bold text-ink">
      Thiếu video
    </span>
  );
}
