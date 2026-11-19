"use client";

import type { Page, WatchHistoryItem } from "@movie/contracts";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { formatDuration } from "../../lib/format";
import type { MovieCardData } from "../../lib/movie-card";
import { useSession } from "../../lib/session";
import { MovieRail } from "./movie-rail";

function toHistoryCard(item: WatchHistoryItem): MovieCardData {
  const episode =
    item.movie.type === "SERIES"
      ? `Mùa ${item.episode.seasonNumber} · Tập ${item.episode.number}`
      : undefined;
  const progress = `Đã xem ${formatDuration(item.progressSec)}`;
  return {
    id: String(item.movie.id),
    title: item.movie.title,
    year: item.movie.releaseYear,
    rating: item.movie.ageRating,
    posterUrl: item.movie.posterUrl,
    href: `/movies/${item.movie.slug}`,
    meta: episode ? `${episode} · ${progress}` : progress,
  };
}

export function ContinueWatching() {
  const user = useSession();
  const [items, setItems] = useState<WatchHistoryItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiClient<Page<WatchHistoryItem>>("/me/history?pageSize=10")
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !items || items.length === 0) return null;
  return <MovieRail title="Xem tiếp" movies={items.map(toHistoryCard)} />;
}
