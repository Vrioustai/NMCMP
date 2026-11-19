import type { MovieCard, MovieDetail, Page } from "@movie/contracts";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeList } from "../../../../components/movie/episode-list";
import { MovieDetailTabs } from "../../../../components/movie/movie-detail-tabs";
import { MovieRail } from "../../../../components/movie/movie-rail";
import { FavoriteButton } from "../../../../components/movie/favorite-button";
import { MovieRating } from "../../../../components/movie/movie-rating";
import { AgeBadge } from "../../../../components/movie/age-badge";
import { ApiError } from "../../../../lib/api/errors";
import { apiServer } from "../../../../lib/api/server";
import { formatDuration } from "../../../../lib/format";
import { getSession } from "../../../../lib/get-session";
import { toCard } from "../../../../lib/movie-card";
import { loginNext, watchPath } from "../../../../lib/watch-path";

const loadMovie = cache((slug: string) =>
  apiServer<MovieDetail>(`/movies/${encodeURIComponent(slug)}`, { notFoundOn404: false }),
);

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function joinNames(items: { name: string }[]): string {
  return items.length > 0 ? items.map((item) => item.name).join(", ") : "—";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const movie = await loadMovie(slug);
    return { title: movie.title };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { title: "Không tìm thấy" };
    throw error;
  }
}

export default async function MoviePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, movie] = await Promise.all([
    getSession(),
    loadMovie(slug).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
  ]);
  const first = movie.seasons[0]?.episodes[0];
  const destination = first ? watchPath(movie.slug, first.id) : null;
  const watchHref = destination ? (user ? destination : loginNext(destination)) : null;
  const duration =
    movie.type === "MOVIE" && first?.durationSec ? formatDuration(first.durationSec) : null;
  const episodeCount = movie.seasons.reduce((sum, season) => sum + season.episodes.length, 0);
  const showEpisodes = movie.type === "SERIES" || episodeCount > 1;
  const genre = movie.genres[0];
  const related = genre
    ? (await apiServer<Page<MovieCard>>(`/movies?genre=${genre.id}&pageSize=12`)).items
        .filter((item) => item.id !== movie.id)
        .slice(0, 10)
    : [];
  const source = httpUrl(movie.sourceUrl);

  return (
    <article className="grid gap-8">
      <div className="relative">
        {movie.backdropUrl ? (
          <div className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden lg:block">
            <Image
              src={movie.backdropUrl}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-30 blur-2xl"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-card bg-raised md:mx-0 md:w-[200px] lg:w-[260px]">
            {movie.posterUrl ? (
              <Image
                src={movie.posterUrl}
                alt=""
                fill
                priority
                sizes="260px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="grid min-w-0 content-start gap-3">
            <h1 className="text-[28px] font-extrabold">{movie.title}</h1>
            {movie.originalTitle ? (
              <p className="text-sm text-muted">{movie.originalTitle}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <AgeBadge rating={movie.ageRating} />
              <span className="text-sm text-muted">{movie.releaseYear}</span>
              {duration ? <span className="text-sm text-muted">{duration}</span> : null}
              <span className="text-sm text-muted">
                {movie.type === "SERIES" ? "Phim bộ" : "Phim lẻ"}
              </span>
            </div>
            <MovieRating
              movieId={movie.id}
              loggedIn={user !== null}
              loginHref={loginNext(`/movies/${movie.slug}`)}
              average={movie.ratingAverage}
              count={movie.ratingCount}
            />
            <div className="flex flex-wrap items-center gap-2">
              {watchHref ? (
                <Link
                  href={watchHref}
                  className="inline-flex h-10 w-fit items-center justify-center rounded-control bg-linear-to-r from-accent to-accent-2 px-4 text-sm font-semibold text-on-accent shadow-glow"
                >
                  Xem phim
                </Link>
              ) : (
                <p className="text-sm text-muted">Chưa có tập</p>
              )}
              <FavoriteButton
                movieId={movie.id}
                loggedIn={user !== null}
                loginHref={loginNext(`/movies/${movie.slug}`)}
              />
            </div>
          </div>
        </div>
      </div>
      {showEpisodes ? (
        <EpisodeList
          seasons={movie.seasons}
          hrefFor={(episodeId) => {
            const path = watchPath(movie.slug, episodeId);
            return user ? path : loginNext(path);
          }}
        />
      ) : null}
      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Thông tin phim</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-dim">Đạo diễn</dt>
            <dd className="text-sm">{joinNames(movie.directors)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-dim">Diễn viên</dt>
            <dd className="text-sm">{joinNames(movie.actors)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-dim">Thể loại</dt>
            <dd className="text-sm">
              {movie.genres.length > 0
                ? movie.genres.map((item, index) => (
                    <span key={item.id}>
                      {index > 0 ? ", " : null}
                      <Link href={`/search?genre=${item.id}`}>{item.name}</Link>
                    </span>
                  ))
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-dim">Quốc gia</dt>
            <dd className="text-sm">
              {movie.countries.length > 0
                ? movie.countries.map((item, index) => (
                    <span key={item.id}>
                      {index > 0 ? ", " : null}
                      <Link href={`/search?country=${item.id}`}>{item.name}</Link>
                    </span>
                  ))
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-sm break-words">
          Nguồn:{" "}
          {source ? (
            <a href={source} rel="noreferrer" target="_blank">
              {source}
            </a>
          ) : (
            (movie.sourceUrl ?? "—")
          )}
          {" · "}
          Giấy phép: {movie.license ?? "—"}
        </p>
      </section>
      <MovieDetailTabs
        description={movie.description}
        actors={movie.actors}
        movieId={movie.id}
        loggedIn={user !== null}
        loginHref={loginNext(`/movies/${movie.slug}`)}
      />
      {related.length > 0 ? (
        <MovieRail title="Phim cùng thể loại" movies={related.map((item) => toCard(item))} />
      ) : null}
    </article>
  );
}
