import type { Country, Genre, MovieCard, Page } from "@movie/contracts";
import Link from "next/link";
import { SearchFilters } from "../../../components/search/search-filters";
import { MovieGrid } from "../../../components/movie/movie-grid";
import { EmptyState } from "../../../components/ui/empty-state";
import { apiServer } from "../../../lib/api/server";
import { formatNumber } from "../../../lib/format";
import { toCard } from "../../../lib/movie-card";
import {
  moviesQuery,
  parseSearchParams,
  searchPath,
  type SearchQuery,
} from "../../../lib/search-query";

export const metadata = { title: "Tìm phim" };

function chipHref(query: SearchQuery, key: keyof SearchQuery): string {
  return searchPath({ ...query, [key]: undefined, page: undefined });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseSearchParams(await searchParams);
  const [result, genres, countries] = await Promise.all([
    apiServer<Page<MovieCard>>(`/movies?${moviesQuery(query)}`),
    apiServer<Genre[]>("/genres"),
    apiServer<Country[]>("/countries"),
  ]);
  const genreName = genres.find((genre) => genre.id === query.genre)?.name;
  const countryName = countries.find((country) => country.id === query.country)?.name;
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const chips = [
    query.q ? { key: "q" as const, label: `“${query.q}”` } : null,
    query.genre ? { key: "genre" as const, label: genreName ?? "Thể loại" } : null,
    query.country ? { key: "country" as const, label: countryName ?? "Quốc gia" } : null,
    query.releaseYear ? { key: "releaseYear" as const, label: String(query.releaseYear) } : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">
        {query.q ? `Kết quả cho “${query.q}”` : "Thể loại"}
      </h1>
      <p className="text-sm text-muted">{formatNumber(result.total)} phim</p>
      <SearchFilters genres={genres} countries={countries} query={query} />
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={chipHref(query, chip.key)}
              className="inline-flex h-7 items-center gap-1 rounded-chip bg-raised px-2 text-[13px] text-muted"
            >
              {chip.label}
              <span aria-hidden>×</span>
              <span className="sr-only">Bỏ {chip.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {result.total === 0 ? (
        <EmptyState title="Không tìm thấy phim" />
      ) : (
        <MovieGrid movies={result.items.map((movie, index) => toCard(movie, index === 0))} />
      )}
      {pageCount > 1 ? (
        <nav aria-label="Phân trang" className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link
              href={searchPath({ ...query, page: result.page - 1 })}
              className="inline-flex h-10 items-center rounded-control bg-raised px-3 text-sm"
            >
              Trước
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-control bg-raised px-3 text-sm opacity-50">
              Trước
            </span>
          )}
          <span className="text-[13px] text-muted">
            {result.page}/{pageCount}
          </span>
          {result.page < pageCount ? (
            <Link
              href={searchPath({ ...query, page: result.page + 1 })}
              className="inline-flex h-10 items-center rounded-control bg-raised px-3 text-sm"
            >
              Sau
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-control bg-raised px-3 text-sm opacity-50">
              Sau
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
