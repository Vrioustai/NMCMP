import type { EpisodeSummary } from "@movie/contracts";
import Link from "next/link";
import { formatDuration } from "../../lib/format";

export function EpisodeList({
  seasons,
  hrefFor,
  currentId,
}: {
  seasons: { number: number; episodes: EpisodeSummary[] }[];
  hrefFor: (episodeId: number) => string;
  currentId?: number;
}) {
  if (seasons.length === 0) return null;
  return (
    <div className="grid gap-4">
      {seasons.map((season) => (
        <section key={season.number} className="grid gap-2">
          <h3 className="text-sm font-semibold">Mùa {season.number}</h3>
          <ol className="grid gap-2">
            {season.episodes.map((episode) => (
              <li key={episode.id}>
                <Link
                  href={hrefFor(episode.id)}
                  aria-current={episode.id === currentId ? "true" : undefined}
                  className={`flex items-center justify-between gap-3 rounded-control px-3 py-2 text-sm ${episode.id === currentId ? "bg-accent text-on-accent" : "bg-raised"}`}
                >
                  <span className="min-w-0 truncate">
                    Tập {episode.number}
                    {episode.title ? ` · ${episode.title}` : ""}
                  </span>
                  {episode.durationSec ? (
                    <span className="shrink-0 text-[13px] text-muted">
                      {formatDuration(episode.durationSec)}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
