import type { HomeSections } from "@movie/contracts";
import { ContinueWatching } from "../../components/movie/continue-watching";
import { DanmakuPromo } from "../../components/movie/danmaku-promo";
import { HeroBanner } from "../../components/movie/hero-banner";
import { MovieRail } from "../../components/movie/movie-rail";
import { TrendingList } from "../../components/movie/trending-list";
import { EmptyState } from "../../components/ui/empty-state";
import { apiServer } from "../../lib/api/server";
import { errorMessage } from "../../lib/error-messages";
import { toCard } from "../../lib/movie-card";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string }>;
}) {
  const { locked } = await searchParams;
  const home = await apiServer<HomeSections>("/movies/home");
  const hasMovies =
    home.newList.length > 0 || home.trendingList.length > 0 || home.byGenre.length > 0;
  const promo = home.newList[0] ?? home.trendingList[0] ?? home.byGenre[0]?.items[0] ?? null;

  return (
    <div className="grid gap-8">
      <h1 className="sr-only">Trang chủ</h1>
      {locked === "1" ? (
        <p role="status" className="rounded-control border border-line bg-card px-4 py-3 text-sm">
          {errorMessage("ACCOUNT_LOCKED")}
        </p>
      ) : null}
      {home.newList.length > 0 ? <HeroBanner movies={home.newList.slice(0, 5)} /> : null}
      <ContinueWatching />
      {hasMovies ? (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-x-6">
          <MovieRail title="Phim mới" movies={home.newList.map((movie) => toCard(movie))} />
          <div className="xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:self-start">
            <TrendingList movies={home.trendingList} />
          </div>
          {home.byGenre.length > 0 ? (
            <div className="grid min-w-0 gap-8">
              {home.byGenre.map((section) => (
                <MovieRail
                  key={section.genre.id}
                  title={section.genre.name}
                  href={`/search?genre=${section.genre.id}`}
                  movies={section.items.map((movie) => toCard(movie))}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title="Chưa có phim" />
      )}
      <DanmakuPromo movie={promo} />
    </div>
  );
}
