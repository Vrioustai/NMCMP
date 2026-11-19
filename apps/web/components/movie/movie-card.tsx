"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MovieCardData } from "../../lib/movie-card";
import { AgeBadge } from "./age-badge";

const PREVIEW_DELAY_MS = 600;

function canPreview(url: string | null | undefined): url is string {
  if (!url) return false;
  // Thẻ video không phát HLS. Trình phát xử lý định dạng đó ở trang xem.
  return !url.split("?")[0].toLowerCase().endsWith(".m3u8");
}

function Trailer({ url }: { url: string }) {
  const [ready, setReady] = useState(false);
  return (
    <video
      className={`absolute inset-0 size-full object-cover ${ready ? "opacity-100" : "opacity-0"}`}
      src={url}
      muted
      playsInline
      autoPlay
      loop
      preload="none"
      aria-hidden
      onPlaying={() => setReady(true)}
    />
  );
}

export function MovieCard({
  title,
  year,
  rating,
  posterUrl,
  href,
  trailerUrl,
  priority = false,
  meta,
}: MovieCardData) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const previewUrl = canPreview(trailerUrl) ? trailerUrl : null;

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

  return (
    <article className="min-w-0">
      <Link href={href} className="block">
        <div
          className="relative aspect-[2/3] overflow-hidden rounded-card bg-raised"
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
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt=""
              fill
              priority={priority}
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 18vw, (min-width: 768px) 30vw, 45vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-raised to-board" />
          )}
          {playing && previewUrl ? <Trailer url={previewUrl} /> : null}
          <span className="absolute top-2 left-2">
            <AgeBadge rating={rating} />
          </span>
        </div>
        <h3 className="mt-2 truncate text-sm font-semibold">{title}</h3>
        {year ? <p className="text-[13px] text-muted">{year}</p> : null}
        {meta ? <p className="truncate text-[13px] text-muted">{meta}</p> : null}
      </Link>
    </article>
  );
}
