"use client";

import { COMMENT_MAX_LENGTH, type CommentItem, type Page } from "@movie/contracts";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { commentBody } from "../../lib/comment-body";
import { errorMessage } from "../../lib/error-messages";
import { formatDate, formatTime } from "../../lib/format";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Spinner } from "../ui/spinner";

const PAGE_SIZE = 10;

export function MovieComments({
  movieId,
  loggedIn,
  loginHref,
}: {
  movieId: number;
  loggedIn: boolean;
  loginHref: string;
}) {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<Page<CommentItem> | null>(null);
  const [failure, setFailure] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = commentBody(draft);
  const remaining = COMMENT_MAX_LENGTH - Array.from(draft).length;

  useEffect(() => {
    let cancelled = false;
    setFailure(false);
    apiClient<Page<CommentItem>>(`/movies/${movieId}/comments?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setFailure(true);
      });
    return () => {
      cancelled = true;
    };
  }, [movieId, page, reload]);

  async function send() {
    if (!body || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiClient(`/movies/${movieId}/comments`, { method: "POST", body: { content: body } });
      setDraft("");
      setPage(1);
      setReload((value) => value + 1);
    } catch (caught) {
      const details = caught instanceof ApiError ? caught.details : undefined;
      setError(
        details?.[0]?.message ?? errorMessage(caught instanceof ApiError ? caught.code : undefined),
      );
    } finally {
      setPending(false);
    }
  }

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="grid gap-4">
      {loggedIn ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="grid gap-1 text-sm" htmlFor="movie-comment">
            Bình luận
            <textarea
              id="movie-comment"
              value={draft}
              rows={3}
              className="rounded-control bg-raised px-3 py-2 text-base"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[13px] ${remaining < 0 ? "text-danger" : "text-muted"}`}>
              {remaining}
            </span>
            <Button type="submit" disabled={body === null || pending}>
              Gửi
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <Link href={loginHref} className="text-sm font-semibold text-accent">
          Đăng nhập để bình luận
        </Link>
      )}
      {failure ? (
        <div className="grid gap-2">
          <p role="alert" className="text-sm">
            Không tải được bình luận.
          </p>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
            Thử lại
          </Button>
        </div>
      ) : null}
      {!data && !failure ? <Spinner /> : null}
      {data && data.items.length === 0 ? <EmptyState title="Chưa có bình luận" /> : null}
      {data && data.items.length > 0 ? (
        <ul className="grid gap-4">
          {data.items.map((item) => (
            <li key={item.id} className="grid gap-1">
              <div className="flex items-center gap-2">
                {item.user.avatarUrl ? (
                  <Image
                    src={item.user.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-pill"
                  />
                ) : null}
                <span className="text-sm font-semibold">{item.user.displayName}</span>
                <time className="text-[13px] text-muted" dateTime={item.createdAt}>
                  {formatDate(item.createdAt)} {formatTime(item.createdAt)}
                </time>
              </div>
              <p className="text-sm whitespace-pre-line">{item.content}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data && data.total > data.pageSize ? (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Trước
          </Button>
          <span className="text-sm text-muted">
            {page}/{lastPage}
          </span>
          <Button
            variant="secondary"
            disabled={page >= lastPage}
            onClick={() => setPage((value) => value + 1)}
          >
            Sau
          </Button>
        </div>
      ) : null}
    </div>
  );
}
