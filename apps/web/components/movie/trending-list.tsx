import type { MovieCard } from "@movie/contracts";
import Image from "next/image";
import Link from "next/link";
import { AgeBadge } from "./age-badge";

export function TrendingList({ movies }: { movies: MovieCard[] }) {
  if (movies.length === 0) return null;
  return (
    <section className="min-w-0" aria-label="Xu hướng 7 ngày">
      <h2 className="mb-3 text-xl font-extrabold">Xu hướng 7 ngày</h2>
      <ol className="grid gap-3">
        {movies.map((movie, index) => (
          <li key={movie.id}>
            <Link href={`/movies/${movie.slug}`} className="flex items-center gap-3">
              <span className="w-6 text-sm font-extrabold text-accent">{index + 1}</span>
              <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-chip bg-raised">
                {movie.posterUrl ? (
                  <Image src={movie.posterUrl} alt="" fill sizes="44px" className="object-cover" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{movie.title}</span>
                <span className="mt-1 flex items-center gap-2">
                  <AgeBadge rating={movie.ageRating} />
                  <span className="text-[13px] text-muted">{movie.releaseYear}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
