"use client";

import type { NamedRef } from "@movie/contracts";
import { useState } from "react";
import { Tabs } from "../ui/tabs";
import { MovieComments } from "./movie-comments";

const TABS = [
  { id: "about", label: "Giới thiệu" },
  { id: "cast", label: "Diễn viên" },
  { id: "comments", label: "Bình luận" },
];

export function MovieDetailTabs({
  description,
  actors,
  movieId,
  loggedIn,
  loginHref,
}: {
  description: string;
  actors: NamedRef[];
  movieId: number;
  loggedIn: boolean;
  loginHref: string;
}) {
  const [tab, setTab] = useState("about");
  return (
    <div className="grid gap-4">
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "about" ? <p className="text-sm whitespace-pre-line">{description}</p> : null}
      {tab === "cast" ? (
        actors.length > 0 ? (
          <ul className="grid gap-2 text-sm">
            {actors.map((actor) => (
              <li key={actor.id}>{actor.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Chưa có diễn viên</p>
        )
      ) : null}
      {tab === "comments" ? (
        <MovieComments movieId={movieId} loggedIn={loggedIn} loginHref={loginHref} />
      ) : null}
    </div>
  );
}
