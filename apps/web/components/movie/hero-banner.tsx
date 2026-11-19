"use client";

import type { MovieCard } from "@movie/contracts";
import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loginNext } from "../../lib/watch-path";
import { useSession } from "../../lib/session";
import { AgeBadge } from "./age-badge";

const PREVIEW_DELAY_MS = 600;

function canPreview(url: string | null): url is string {
  if (!url) return false;
  return !url.split("?")[0].toLowerCase().endsWith(".m3u8");
}

function BannerCopy({ movie, favoriteHref }: { movie: MovieCard; favoriteHref: string }) {
  return (
    <div className="grid justify-items-start gap-3">
      <p className="text-[12px] font-bold tracking-wide text-accent">PHIM MỚI</p>
      <h2 className="text-2xl font-extrabold">{movie.title}</h2>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <AgeBadge rating={movie.ageRating} />
        <span>{movie.releaseYear}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/movies/${movie.slug}`}
          className="inline-flex h-10 items-center justify-center rounded-control bg-linear-to-r from-accent to-accent-2 px-4 text-sm font-semibold text-on-accent shadow-glow"
        >
          Xem ngay
        </Link>
        <Link
          href={favoriteHref}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-control border border-line px-4 text-sm font-semibold"
        >
          <Heart size={16} />
          Yêu thích
        </Link>
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
  const favoriteHref = user ? "/me/favorites" : loginNext(`/movies/${movie.slug}`);

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
        <div className="relative aspect-[4/5] md:aspect-video lg:aspect-[16/7]">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-raised to-board" />
          )}
          {playing && previewUrl ? (
            <video
              className="absolute inset-0 size-full object-cover"
              src={previewUrl}
              muted
              playsInline
              autoPlay
              loop
              preload="none"
              aria-hidden
            />
          ) : null}
          <div className="absolute inset-0 hidden bg-linear-to-t from-page via-page/20 to-transparent md:block" />
          <div className="absolute inset-x-0 bottom-0 hidden p-6 md:block">
            <BannerCopy movie={movie} favoriteHref={favoriteHref} />
          </div>
        </div>
        <div className="p-4 md:hidden">
          <BannerCopy movie={movie} favoriteHref={favoriteHref} />
        </div>
      </article>
      {movies.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2">
          {movies.map((item, dot) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Phim ${dot + 1}: ${item.title}`}
              aria-current={dot === index}
              className={`size-2 rounded-pill ${dot === index ? "bg-accent" : "bg-raised"}`}
              onClick={() => {
                clear();
                setIndex(dot);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
