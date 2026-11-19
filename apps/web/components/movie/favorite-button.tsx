"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { errorMessage } from "../../lib/error-messages";

export function FavoriteButton({
  movieId,
  loggedIn,
  loginHref,
}: {
  movieId: number;
  loggedIn: boolean;
  loginHref: string;
}) {
  const [on, setOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    apiClient<{ isFavorite: boolean }>(`/me/movies/${movieId}/state`)
      .then((state) => {
        if (!cancelled) setOn(state.isFavorite);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [loggedIn, movieId]);

  if (!loggedIn) {
    return (
      <Link
        href={loginHref}
        className="inline-flex h-10 items-center gap-2 rounded-control bg-raised px-4 text-sm font-semibold"
      >
        <Heart size={16} />
        Yêu thích
      </Link>
    );
  }

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await apiClient(`/me/favorites/${movieId}`, { method: on ? "DELETE" : "PUT" });
      setOn((value) => !value);
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-control bg-raised px-4 text-sm font-semibold disabled:opacity-50"
        onClick={() => void toggle()}
      >
        <Heart size={16} className={on ? "fill-accent text-accent" : undefined} />
        {on ? "Đã yêu thích" : "Yêu thích"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
