"use client";

import type { RatingSummary } from "@movie/contracts";
import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { errorMessage } from "../../lib/error-messages";
import { RatingStars } from "./rating-stars";

export function MovieRating({
  movieId,
  loggedIn,
  loginHref,
  average,
  count,
}: {
  movieId: number;
  loggedIn: boolean;
  loginHref: string;
  average: number | null;
  count: number;
}) {
  const [shownAverage, setShownAverage] = useState(average);
  const [shownCount, setShownCount] = useState(count);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    apiClient<{ myScore: number | null }>(`/me/movies/${movieId}/state`)
      .then((state) => {
        if (!cancelled) setMyScore(state.myScore);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [loggedIn, movieId]);

  async function rate(score: number) {
    setPending(true);
    setError(null);
    try {
      const next = await apiClient<RatingSummary>(`/movies/${movieId}/rating`, {
        method: "PUT",
        body: { score },
      });
      setShownAverage(next.ratingAverage);
      setShownCount(next.ratingCount);
      setMyScore(score);
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <RatingStars average={shownAverage} count={shownCount} />
      {loggedIn ? (
        <div className="flex" role="group" aria-label="Chấm sao">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              aria-label={`${score} sao`}
              aria-pressed={myScore === score}
              disabled={pending}
              className="inline-flex size-10 items-center justify-center rounded-control disabled:opacity-50"
              onClick={() => void rate(score)}
            >
              <Star
                size={20}
                className={score <= (myScore ?? 0) ? "fill-accent text-accent" : "text-dim"}
              />
            </button>
          ))}
        </div>
      ) : (
        <Link href={loginHref} className="text-sm font-semibold text-accent">
          Đăng nhập để chấm sao
        </Link>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
