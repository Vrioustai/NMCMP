"use client";

import type { MovieCard } from "@movie/contracts";
import { useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { errorMessage } from "../../lib/error-messages";
import { toCard } from "../../lib/movie-card";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { MovieCard as MoviePoster } from "./movie-card";

export function FavoriteGrid({ movies }: { movies: MovieCard[] }) {
  const [ids, setIds] = useState(() => movies.map((movie) => movie.id));
  const [error, setError] = useState<string | null>(null);
  const visible = movies.filter((movie) => ids.includes(movie.id));

  if (visible.length === 0) return <EmptyState title="Chưa có phim yêu thích" />;

  async function remove(movieId: number) {
    setError(null);
    try {
      await apiClient(`/me/favorites/${movieId}`, { method: "DELETE" });
      setIds((current) => current.filter((id) => id !== movieId));
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    }
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 min-[900px]:grid-cols-4 lg:gap-4 xl:grid-cols-5 2xl:grid-cols-6">
        {visible.map((movie) => (
          <li key={movie.id} className="grid content-start gap-2">
            <MoviePoster {...toCard(movie)} />
            <Button variant="secondary" onClick={() => void remove(movie.id)}>
              Bỏ yêu thích
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
