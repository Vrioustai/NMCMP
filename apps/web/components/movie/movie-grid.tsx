import type { MovieCardData } from "../../lib/movie-card";
import { MovieCard } from "./movie-card";

export type { MovieCardData } from "../../lib/movie-card";

export function MovieGrid({ movies }: { movies: MovieCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 min-[900px]:grid-cols-4 lg:gap-4 xl:grid-cols-5 2xl:grid-cols-6">
      {movies.map((movie) => (
        <li key={movie.id}>
          <MovieCard {...movie} />
        </li>
      ))}
    </ul>
  );
}
