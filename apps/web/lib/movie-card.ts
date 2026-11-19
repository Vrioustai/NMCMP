import type { AgeRating, MovieCard } from "@movie/contracts";

export type MovieCardData = {
  id: string;
  title: string;
  year: number | null;
  rating: AgeRating;
  posterUrl?: string | null;
  href: string;
  trailerUrl?: string | null;
  priority?: boolean;
  meta?: string;
};

export function toCard(movie: MovieCard, priority = false): MovieCardData {
  return {
    id: String(movie.id),
    title: movie.title,
    year: movie.releaseYear,
    rating: movie.ageRating,
    posterUrl: movie.posterUrl,
    href: `/movies/${movie.slug}`,
    trailerUrl: movie.trailerUrl,
    priority,
  };
}
