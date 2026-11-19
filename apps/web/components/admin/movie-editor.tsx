"use client";

import {
  AGE_RATINGS,
  MOVIE_TYPES,
  SLUG_PATTERN,
  type AdminEpisodeSummary,
  type AdminGenre,
  type AdminMovieDetail,
  type AgeRating,
  type MovieType,
} from "@movie/contracts";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { directUploadError } from "../../lib/admin-upload";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { errorsByField } from "../../lib/field-errors";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { ErrorState } from "../ui/error-state";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

type Fields = {
  title: string;
  slug: string;
  description: string;
  type: MovieType;
  releaseYear: string;
  ageRating: AgeRating;
  genreIds: number[];
  countries: string;
  directors: string;
  actors: string;
  sourceUrl: string;
  license: string;
  originalTitle: string;
  trailerUrl: string;
};

const EMPTY: Fields = {
  title: "",
  slug: "",
  description: "",
  type: "MOVIE",
  releaseYear: String(new Date().getFullYear()),
  ageRating: "P",
  genreIds: [],
  countries: "",
  directors: "",
  actors: "",
  sourceUrl: "",
  license: "",
  originalTitle: "",
  trailerUrl: "",
};

export function MovieEditor({ movieId }: { movieId?: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [genres, setGenres] = useState<AdminGenre[]>([]);
  const [movie, setMovie] = useState<AdminMovieDetail | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loaded, setLoaded] = useState(!movieId);

  useEffect(() => {
    let gone = false;
    apiClient<AdminGenre[]>("/admin/genres")
      .then((rows) => {
        if (!gone) setGenres(rows);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (!movieId) return;
    let gone = false;
    apiClient<AdminMovieDetail>(`/admin/movies/${movieId}`)
      .then((detail) => {
        if (gone) return;
        setMovie(detail);
        setFields(fromMovie(detail));
        setLoaded(true);
      })
      .catch((caught) => {
        if (!gone) setMessage(caught instanceof ApiError ? caught.message : "Không tải được phim.");
      });
    return () => {
      gone = true;
    };
  }, [movieId]);

  function patch<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const local = localErrors(fields);
    setFieldErrors(local);
    if (Object.keys(local).length > 0) return;
    setPending(true);
    setMessage("");
    try {
      const saved = await apiClient<AdminMovieDetail>(
        movieId ? `/admin/movies/${movieId}` : "/admin/movies",
        { method: movieId ? "PATCH" : "POST", body: toBody(fields) },
      );
      if (!movieId) {
        router.push(`/admin/movies/${saved.id}`);
        router.refresh();
        return;
      }
      setMovie(saved);
      setFields(fromMovie(saved));
      setMessage("Đã lưu.");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(errorsByField(caught.details));
        setMessage(caught.message);
      }
    } finally {
      setPending(false);
    }
  }

  async function reload() {
    if (!movieId) return;
    const detail = await apiClient<AdminMovieDetail>(`/admin/movies/${movieId}`);
    setMovie(detail);
    setFields(fromMovie(detail));
  }

  if (movieId && !loaded && !message) return <p className="text-sm text-muted">Đang tải…</p>;
  if (movieId && !movie) return <ErrorState title={message || "Không tìm thấy phim."} />;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{movie ? movie.title : "Thêm phim"}</h1>
        <Link href="/admin/movies" className="text-sm text-accent">
          Về danh sách
        </Link>
      </div>
      <form className="grid gap-4" onSubmit={save}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Tiêu đề"
            name="title"
            value={fields.title}
            error={fieldErrors.title}
            onChange={(event) => patch("title", event.target.value)}
          />
          <Input
            label="Slug"
            name="slug"
            value={fields.slug}
            error={fieldErrors.slug}
            onChange={(event) => patch("slug", event.target.value)}
          />
          <Select
            label="Loại"
            name="type"
            value={fields.type}
            onChange={(event) => patch("type", event.target.value as MovieType)}
          >
            {MOVIE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "MOVIE" ? "Phim lẻ" : "Phim bộ"}
              </option>
            ))}
          </Select>
          <Input
            label="Năm"
            name="releaseYear"
            inputMode="numeric"
            value={fields.releaseYear}
            error={fieldErrors.releaseYear}
            onChange={(event) => patch("releaseYear", event.target.value)}
          />
          <Select
            label="Nhãn độ tuổi"
            name="ageRating"
            value={fields.ageRating}
            onChange={(event) => patch("ageRating", event.target.value as AgeRating)}
          >
            {AGE_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </Select>
          <Input
            label="Nguồn"
            name="sourceUrl"
            value={fields.sourceUrl}
            error={fieldErrors.sourceUrl}
            onChange={(event) => patch("sourceUrl", event.target.value)}
          />
        </div>
        <label className="grid gap-1 text-sm">
          <span>Mô tả</span>
          <textarea
            name="description"
            value={fields.description}
            onChange={(event) => patch("description", event.target.value)}
            className="min-h-28 rounded-control border border-line bg-raised px-3 py-2 text-base text-ink md:text-sm"
          />
          {fieldErrors.description ? (
            <span className="text-[13px] text-danger">{fieldErrors.description}</span>
          ) : null}
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-sm">Thể loại</legend>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => {
              const checked = fields.genreIds.includes(genre.id);
              return (
                <label
                  key={genre.id}
                  className="inline-flex h-10 items-center gap-2 rounded-control bg-raised px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      patch(
                        "genreIds",
                        checked
                          ? fields.genreIds.filter((id) => id !== genre.id)
                          : [...fields.genreIds, genre.id],
                      )
                    }
                  />
                  {genre.name}
                </label>
              );
            })}
          </div>
          {fieldErrors.genreIds ? (
            <span className="text-[13px] text-danger">{fieldErrors.genreIds}</span>
          ) : null}
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Quốc gia, cách nhau bởi dấu phẩy"
            name="countries"
            value={fields.countries}
            onChange={(event) => patch("countries", event.target.value)}
          />
          <Input
            label="Đạo diễn, cách nhau bởi dấu phẩy"
            name="directors"
            value={fields.directors}
            onChange={(event) => patch("directors", event.target.value)}
          />
          <Input
            label="Diễn viên, cách nhau bởi dấu phẩy"
            name="actors"
            value={fields.actors}
            onChange={(event) => patch("actors", event.target.value)}
          />
          <Input
            label="Giấy phép"
            name="license"
            value={fields.license}
            error={fieldErrors.license}
            onChange={(event) => patch("license", event.target.value)}
          />
          <Input
            label="Tên gốc"
            name="originalTitle"
            value={fields.originalTitle}
            onChange={(event) => patch("originalTitle", event.target.value)}
          />
          <Input
            label="Trailer"
            name="trailerUrl"
            value={fields.trailerUrl}
            error={fieldErrors.trailerUrl}
            onChange={(event) => patch("trailerUrl", event.target.value)}
          />
        </div>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {movieId ? "Lưu" : "Tạo phim"}
        </Button>
      </form>
      {movie ? (
        <>
          <ImageFields movie={movie} onDone={reload} onError={setMessage} />
          <EpisodeTable movie={movie} onDone={reload} onError={setMessage} />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                changeStatus(
                  movie,
                  movie.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                  setMessage,
                  reload,
                )
              }
            >
              {movie.status === "PUBLISHED" ? "Chuyển nháp" : "Công khai"}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Xóa phim
            </Button>
          </div>
          <ConfirmDialog
            open={confirmDelete}
            title="Xóa phim"
            message="Phim, tập, phụ đề và ảnh sẽ bị xóa. Không hoàn tác được."
            confirmLabel="Xóa"
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => {
              setConfirmDelete(false);
              void apiClient(`/admin/movies/${movie.id}`, { method: "DELETE" }).then(() => {
                router.push("/admin/movies");
                router.refresh();
              });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function ImageFields({
  movie,
  onDone,
  onError,
}: {
  movie: AdminMovieDetail;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <ImageSlot
        kind="poster"
        label="Poster"
        url={movie.posterUrl}
        movieId={movie.id}
        onDone={onDone}
        onError={onError}
      />
      <ImageSlot
        kind="backdrop"
        label="Ảnh nền"
        url={movie.backdropUrl}
        movieId={movie.id}
        onDone={onDone}
        onError={onError}
      />
    </section>
  );
}

function ImageSlot({
  kind,
  label,
  url,
  movieId,
  onDone,
  onError,
}: {
  kind: "poster" | "backdrop";
  label: string;
  url: string | null;
  movieId: number;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm">{label}</span>
      {url ? (
        <Image
          src={url}
          alt=""
          width={160}
          height={240}
          unoptimized
          className="max-h-40 w-auto rounded-control object-contain"
        />
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const body = new FormData();
          body.append("file", file);
          void apiClient(`/admin/movies/${movieId}/images/${kind}`, { method: "POST", body })
            .then(() => onDone())
            .catch((caught) =>
              onError(caught instanceof ApiError ? caught.message : "Không tải được ảnh."),
            );
        }}
      />
    </div>
  );
}

function EpisodeTable({
  movie,
  onDone,
  onError,
}: {
  movie: AdminMovieDetail;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");

  async function addEpisode(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiClient(`/admin/movies/${movie.id}/episodes`, {
        method: "POST",
        body: {
          seasonNumber: Number(seasonNumber),
          number: Number(number),
          title: title.trim() || null,
        },
      });
      setNumber("");
      setTitle("");
      await onDone();
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : "Không thêm được tập.");
    }
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-extrabold">Tập</h2>
      {movie.type === "SERIES" ? (
        <form className="grid gap-3 md:grid-cols-4" onSubmit={addEpisode}>
          <Input
            label="Mùa"
            name="seasonNumber"
            inputMode="numeric"
            value={seasonNumber}
            onChange={(event) => setSeasonNumber(event.target.value)}
          />
          <Input
            label="Số tập"
            name="number"
            inputMode="numeric"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
          <Input
            label="Tên tập"
            name="episodeTitle"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className="self-end">
            <Button type="submit">Thêm tập</Button>
          </div>
        </form>
      ) : null}
      <div className="grid gap-3">
        {movie.episodes.map((episode) => (
          <EpisodeCard key={episode.id} episode={episode} onDone={onDone} onError={onError} />
        ))}
      </div>
    </section>
  );
}

function EpisodeCard({
  episode,
  onDone,
  onError,
}: {
  episode: AdminEpisodeSummary;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [uid, setUid] = useState(episode.streamUid ?? "");
  const [link, setLink] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [xhr, setXhr] = useState<XMLHttpRequest | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (progress === null) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [progress]);

  async function checkVideo() {
    try {
      await apiClient(`/admin/episodes/${episode.id}/stream`, {
        method: "PUT",
        body: { streamUid: uid.trim() },
      });
      await onDone();
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : "Video chưa sẵn sàng.");
    }
  }

  function startUpload(file: File) {
    const blocked = directUploadError(file.size);
    if (blocked) {
      onError(blocked);
      return;
    }
    void apiClient<{ uid: string; uploadUrl: string }>(
      `/admin/episodes/${episode.id}/stream-upload`,
      {
        method: "POST",
        body: {},
      },
    )
      .then((ticket) => {
        const request = new XMLHttpRequest();
        setXhr(request);
        setProgress(0);
        request.open("POST", ticket.uploadUrl);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(event.loaded / event.total);
        };
        request.onload = () => {
          setProgress(null);
          setXhr(null);
          if (request.status >= 200 && request.status < 300) {
            setUid(ticket.uid);
            onError("Tải xong. Bấm Kiểm tra video để gắn vào tập.");
          } else onError("Tải video không thành công. Tập chưa được gắn.");
        };
        request.onerror = () => {
          setProgress(null);
          setXhr(null);
          onError("Tải video không thành công. Tập chưa được gắn.");
        };
        request.onabort = () => {
          setProgress(null);
          setXhr(null);
        };
        const body = new FormData();
        body.append("file", file);
        request.send(body);
      })
      .catch((caught) =>
        onError(caught instanceof ApiError ? caught.message : "Không tạo được lượt tải."),
      );
  }

  return (
    <article className="grid gap-3 rounded-panel border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          Mùa {episode.seasonNumber} · Tập {episode.number}
          {episode.title ? ` · ${episode.title}` : ""}
        </h3>
        <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
          Xóa tập
        </Button>
      </div>
      <p className="text-[13px] text-muted">
        {episode.streamUid ? `Đã gắn ${episode.streamUid}` : "Chưa có video"}
        {episode.durationSec ? ` · ${episode.durationSec} giây` : ""}
        {episode.subtitleUrl ? " · Có phụ đề" : ""}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Mã video"
          name={`uid-${episode.id}`}
          value={uid}
          onChange={(event) => setUid(event.target.value)}
        />
        <div className="self-end">
          <Button onClick={() => void checkVideo()}>Kiểm tra video</Button>
        </div>
        <Input
          label="Link https"
          name={`link-${episode.id}`}
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
        <div className="self-end">
          <Button
            variant="secondary"
            onClick={() => {
              void apiClient<{ streamUid: string }>(`/admin/episodes/${episode.id}/stream-copy`, {
                method: "POST",
                body: { url: link.trim() },
              })
                .then((copied) => {
                  setUid(copied.streamUid);
                  onError("Đã nhận mã video. Bấm Kiểm tra video để gắn vào tập.");
                })
                .catch((caught) =>
                  onError(caught instanceof ApiError ? caught.message : "Không nhận được link."),
                );
            }}
          >
            Lấy từ link
          </Button>
        </div>
      </div>
      <label className="grid gap-1 text-sm">
        <span>Tải file, tối đa 200 MB</span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) startUpload(file);
          }}
        />
      </label>
      {progress !== null ? (
        <div className="grid gap-2">
          <div
            className="h-2 overflow-hidden rounded-chip bg-raised"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          >
            <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              xhr?.abort();
            }}
          >
            Hủy tải
          </Button>
        </div>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span>Phụ đề tiếng Việt (.vtt)</span>
        <input
          type="file"
          accept=".vtt,text/vtt"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const body = new FormData();
            body.append("file", file);
            void apiClient(`/admin/episodes/${episode.id}/subtitles/vi`, { method: "PUT", body })
              .then(() => onDone())
              .catch((caught) =>
                onError(caught instanceof ApiError ? caught.message : "Không tải được phụ đề."),
              );
          }}
        />
      </label>
      {episode.subtitleUrl ? (
        <Button
          variant="secondary"
          onClick={() => {
            void apiClient(`/admin/episodes/${episode.id}/subtitles/vi`, { method: "DELETE" })
              .then(() => onDone())
              .catch((caught) =>
                onError(caught instanceof ApiError ? caught.message : "Không xóa được phụ đề."),
              );
          }}
        >
          Xóa phụ đề
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa tập"
        message="Tập và phụ đề của tập sẽ bị xóa."
        confirmLabel="Xóa"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void apiClient(`/admin/episodes/${episode.id}`, { method: "DELETE" })
            .then(() => onDone())
            .catch((caught) =>
              onError(caught instanceof ApiError ? caught.message : "Không xóa được tập."),
            );
        }}
      />
    </article>
  );
}

async function changeStatus(
  movie: AdminMovieDetail,
  status: "DRAFT" | "PUBLISHED",
  onError: (message: string) => void,
  onDone: () => Promise<void>,
) {
  try {
    await apiClient(`/admin/movies/${movie.id}/status`, { method: "PATCH", body: { status } });
    onError(status === "PUBLISHED" ? "Đã công khai." : "Đã chuyển về nháp.");
    await onDone();
  } catch (caught) {
    onError(caught instanceof ApiError ? caught.message : "Không đổi được trạng thái.");
  }
}

function fromMovie(movie: AdminMovieDetail): Fields {
  return {
    title: movie.title,
    slug: movie.slug,
    description: movie.description,
    type: movie.type,
    releaseYear: String(movie.releaseYear),
    ageRating: movie.ageRating,
    genreIds: movie.genres.map((genre) => genre.id),
    countries: movie.countries.map((item) => item.name).join(", "),
    directors: movie.directors.map((item) => item.name).join(", "),
    actors: movie.actors.map((item) => item.name).join(", "),
    sourceUrl: movie.sourceUrl ?? "",
    license: movie.license ?? "",
    originalTitle: movie.originalTitle ?? "",
    trailerUrl: movie.trailerUrl ?? "",
  };
}

function toBody(fields: Fields) {
  return {
    title: fields.title.trim(),
    slug: fields.slug.trim(),
    description: fields.description.trim(),
    type: fields.type,
    releaseYear: Number(fields.releaseYear),
    ageRating: fields.ageRating,
    genreIds: fields.genreIds,
    sourceUrl: fields.sourceUrl.trim(),
    license: fields.license.trim(),
    originalTitle: fields.originalTitle.trim() || null,
    trailerUrl: fields.trailerUrl.trim() || null,
    countries: splitNames(fields.countries),
    directors: splitNames(fields.directors),
    actors: splitNames(fields.actors),
  };
}

function localErrors(fields: Fields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fields.title.trim()) errors.title = "Thiếu tiêu đề";
  if (!SLUG_PATTERN.test(fields.slug.trim()))
    errors.slug = "Slug chỉ gồm chữ thường, số và dấu gạch ngang";
  if (!fields.description.trim()) errors.description = "Thiếu mô tả";
  if (!Number.isInteger(Number(fields.releaseYear)))
    errors.releaseYear = "Năm phát hành không hợp lệ";
  if (fields.genreIds.length === 0) errors.genreIds = "Cần ít nhất một thể loại";
  if (!fields.sourceUrl.trim()) errors.sourceUrl = "Thiếu nguồn";
  if (!fields.license.trim()) errors.license = "Thiếu giấy phép";
  return errors;
}

function splitNames(value: string): string[] {
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return [...new Set(names)];
}
