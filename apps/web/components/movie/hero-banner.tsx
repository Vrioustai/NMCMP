"use client";

import type { MovieCard } from "@movie/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loginNext } from "../../lib/watch-path";
import { useSession } from "../../lib/session";
import { AgeBadge } from "./age-badge";
import { FavoriteButton } from "./favorite-button";

const PREVIEW_DELAY_MS = 600;

function canPreview(url: string | null): url is string {
  if (!url) return false;
  return !url.split("?")[0].toLowerCase().endsWith(".m3u8");
}

function BannerCopy({ movie, loggedIn }: { movie: MovieCard; loggedIn: boolean }) {
  return (
    <div className="grid justify-items-start gap-3">
      <p className="text-[12px] font-bold tracking-wide text-accent">PHIM MỚI</p>
      <h2 className="text-2xl font-extrabold">{movie.title}</h2>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <AgeBadge rating={movie.ageRating} />
        <span>{movie.releaseYear}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/movies/${movie.slug}`}
          className="inline-flex h-10 items-center justify-center rounded-control bg-linear-to-r from-accent to-accent-2 px-4 text-sm font-semibold text-on-accent shadow-glow"
        >
          Xem ngay
        </Link>
        <FavoriteButton
          movieId={movie.id}
          loggedIn={loggedIn}
          loginHref={loginNext(`/movies/${movie.slug}`)}
        />
      </div>
    </div>
  );
}

export function HeroBanner({ movies }: { movies: MovieCard[] }) {
  const user = useSession();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const movie = movies[Math.min(index, movies.length - 1)];
  const previewUrl = movie && canPreview(movie.trailerUrl) ? movie.trailerUrl : null;

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setPlaying(false);
  };

  const arm = () => {
    if (!previewUrl || timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setPlaying(true);
    }, PREVIEW_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!movie) return null;
  const loggedIn = user !== null;
  const step = (direction: number) => {
    clear();
    setIndex((current) => (current + direction + movies.length) % movies.length);
  };

  return (
    <section aria-roledescription="carousel" aria-label="Phim mới">
      <article
        className="overflow-hidden rounded-card bg-card"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") arm();
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") arm();
        }}
        onPointerLeave={clear}
        onPointerUp={(event) => {
          if (event.pointerType !== "mouse") clear();
        }}
        onPointerCancel={clear}
      >
        <div className="relative md:aspect-[16/7]">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt=""
              fill
              sizes="100vw"
              className="absolute inset-0 hidden scale-110 object-cover blur-2xl md:block"
            />
          ) : (
            <div className="absolute inset-0 hidden bg-linear-to-br from-raised to-board md:block" />
          )}
          <div className="absolute inset-0 hidden bg-linear-to-r from-page via-page/75 to-page/25 md:block" />
          <div className="relative z-10 flex flex-col gap-4 p-4 md:absolute md:inset-0 md:flex-row md:items-center md:p-6">
            {movie.posterUrl ? (
              <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-card md:mx-0 md:h-[82%] md:w-auto">
                <Image
                  src={movie.posterUrl}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="280px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-[2/3] w-40 shrink-0 rounded-card bg-linear-to-br from-raised to-board" />
            )}
            <BannerCopy movie={movie} loggedIn={loggedIn} />
          </div>
          {playing && previewUrl ? (
            <video
              className="absolute inset-0 z-20 size-full object-cover"
              src={previewUrl}
              muted
              playsInline
              autoPlay
              loop
              preload="none"
              aria-hidden
            />
          ) : null}
          {movies.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Phim trước"
                className="absolute top-1/2 left-3 z-30 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-control bg-page/80 text-ink"
                onClick={() => step(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Phim sau"
                className="absolute top-1/2 right-3 z-30 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-control bg-page/80 text-ink"
                onClick={() => step(1)}
              >
                <ChevronRight size={20} />
              </button>
            </>
          ) : null}
        </div>
      </article>
      {movies.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2">
          {movies.map((item, dot) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Phim ${dot + 1}: ${item.title}`}
              aria-current={dot === index ? "true" : undefined}
              className="inline-flex size-6 items-center justify-center"
              onClick={() => {
                clear();
                setIndex(dot);
              }}
            >
              <span
                className={`size-2 rounded-pill ${dot === index ? "bg-accent" : "bg-raised"}`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
