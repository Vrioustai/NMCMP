"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => {
      const max = node.scrollWidth - node.clientWidth;
      setEdges({
        left: node.scrollLeft > 1,
        right: max - node.scrollLeft > 1,
      });
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [movies.length]);
  if (movies.length === 0) return null;
  const scrollBy = (direction: number) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(node.clientWidth * 0.8, 240), behavior: "smooth" });
  };
  const canScroll = edges.left || edges.right;
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
        {canScroll ? (
          <div className="hidden gap-2 lg:flex">
            <IconButton
              aria-label="Cuộn sang trái"
              disabled={!edges.left}
              onClick={() => scrollBy(-1)}
            >
              <ChevronLeft size={20} />
            </IconButton>
            <IconButton
              aria-label="Cuộn sang phải"
              disabled={!edges.right}
              onClick={() => scrollBy(1)}
            >
              <ChevronRight size={20} />
            </IconButton>
          </div>
        ) : null}
      </div>
      <div
        ref={scroller}
        className="flex snap-x gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {movies.map((movie) => (
          <div key={movie.id} className="w-36 shrink-0 snap-start sm:w-40">
            <MovieCard {...movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
