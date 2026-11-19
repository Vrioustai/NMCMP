import type { MovieDetail } from "@movie/contracts";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeList } from "../../../../../components/movie/episode-list";
import { VideoPlayer } from "../../../../../components/player/video-player";
import { ApiError } from "../../../../../lib/api/errors";
import { apiServer } from "../../../../../lib/api/server";
import { watchPath } from "../../../../../lib/watch-path";

const loadMovie = cache((slug: string) =>
  apiServer<MovieDetail>(`/movies/${encodeURIComponent(slug)}`, { notFoundOn404: false }),
);

function episodeIdOf(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const movie = await loadMovie(slug);
    return { title: movie.title, robots: { index: false, follow: false } };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { title: "Không tìm thấy", robots: { index: false, follow: false } };
    }
    throw error;
  }
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; episode: string }>;
  searchParams: Promise<{ measure?: string }>;
}) {
  const [{ slug, episode }, query] = await Promise.all([params, searchParams]);
  const episodeId = episodeIdOf(episode);
  if (episodeId === null) notFound();
  let movie: MovieDetail;
  try {
    movie = await loadMovie(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const current = movie.seasons
    .flatMap((season) => season.episodes)
    .find((item) => item.id === episodeId);
  if (!current) notFound();
  const showEpisodes =
    movie.type === "SERIES" ||
    movie.seasons.reduce((sum, season) => sum + season.episodes.length, 0) > 1;

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">
          <Link href={`/movies/${movie.slug}`}>{movie.title}</Link>
        </h1>
        {movie.type === "SERIES" ? (
          <p className="mt-1 text-sm text-muted">
            Mùa {current.seasonNumber} · Tập {current.number}
            {current.title ? ` · ${current.title}` : ""}
          </p>
        ) : null}
      </div>
      <VideoPlayer slug={movie.slug} episodeId={episodeId} measure={query.measure === "1"} />
      {showEpisodes ? (
        <EpisodeList
          seasons={movie.seasons}
          currentId={episodeId}
          hrefFor={(id) => watchPath(movie.slug, id)}
        />
      ) : null}
    </div>
  );
}
