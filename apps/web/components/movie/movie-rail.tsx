"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import type { MovieCardData } from "../../lib/movie-card";
import { IconButton } from "../ui/icon-button";
import { MovieCard } from "./movie-card";

export function MovieRail({
  title,
  href,
  movies,
}: {
  title: string;
  href?: string;
  movies: MovieCardData[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  if (movies.length === 0) return null;
  const scrollBy = (direction: number) => {
    scroller.current?.scrollBy({ left: direction * 240, behavior: "smooth" });
  };
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        {href ? (
          <h2 className="text-xl font-extrabold">
            <Link href={href}>{title}</Link>
          </h2>
        ) : (
          <h2 className="text-xl font-extrabold">{title}</h2>
        )}
        <div className="hidden gap-2 lg:flex">
          <IconButton aria-label="Cuộn sang trái" onClick={() => scrollBy(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton aria-label="Cuộn sang phải" onClick={() => scrollBy(1)}>
            <ChevronRight size={20} />
          </IconButton>
        </div>
      </div>
      <div ref={scroller} className="flex snap-x gap-3 overflow-x-auto lg:gap-4">
        {movies.map((movie) => (
          <div key={movie.id} className="w-36 shrink-0 snap-start sm:w-40">
            <MovieCard {...movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
