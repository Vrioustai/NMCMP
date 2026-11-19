"use client";

import type { AdminGenre } from "@movie/contracts";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { Input } from "../ui/input";

export function GenreManager() {
  const [genres, setGenres] = useState<AdminGenre[] | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function load() {
    setGenres(await apiClient<AdminGenre[]>("/admin/genres"));
  }

  useEffect(() => {
    void load().catch((caught) =>
      setMessage(caught instanceof ApiError ? caught.message : "Không tải được thể loại."),
    );
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await apiClient("/admin/genres", { method: "POST", body: { name } });
      setName("");
      await load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Không thêm được thể loại.");
    }
  }

  async function rename(genre: AdminGenre, next: string) {
    setMessage("");
    try {
      await apiClient(`/admin/genres/${genre.id}`, { method: "PATCH", body: { name: next } });
      await load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Không sửa được thể loại.");
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Thể loại</h1>
      <form className="flex flex-wrap items-end gap-2" onSubmit={create}>
        <div className="min-w-0 flex-1">
          <Input
            label="Tên thể loại"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit">Thêm</Button>
      </form>
      {message ? <p className="text-sm text-danger">{message}</p> : null}
      {genres && genres.length === 0 ? <EmptyState title="Chưa có thể loại" /> : null}
      {genres && genres.length > 0 ? (
        <>
          <div className="grid gap-3 md:hidden">
            {genres.map((genre) => (
              <GenreCard
                key={genre.id}
                genre={genre}
                onRename={rename}
                onDelete={() => setPendingId(genre.id)}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-panel border border-line md:block">
            <table className="w-full text-left">
              <thead className="text-[13px] text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">Tên</th>
                  <th className="px-3 py-3 font-semibold">Số phim</th>
                  <th className="px-3 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {genres.map((genre) => (
                  <tr key={genre.id} className="border-t border-line">
                    <td className="px-3 py-3">
                      <RenameField genre={genre} onRename={rename} />
                    </td>
                    <td className="px-3 py-3 text-sm">{genre.movieCount}</td>
                    <td className="px-3 py-3">
                      <DeleteGenre genre={genre} onDelete={() => setPendingId(genre.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <ConfirmDialog
        open={pendingId !== null}
        title="Xóa thể loại"
        message="Thể loại này sẽ bị xóa."
        confirmLabel="Xóa"
        onClose={() => setPendingId(null)}
        onConfirm={() => {
          const id = pendingId;
          setPendingId(null);
          if (id === null) return;
          void apiClient(`/admin/genres/${id}`, { method: "DELETE" })
            .then(() => load())
            .catch((caught) =>
              setMessage(caught instanceof ApiError ? caught.message : "Không xóa được thể loại."),
            );
        }}
      />
    </div>
  );
}

function GenreCard({
  genre,
  onRename,
  onDelete,
}: {
  genre: AdminGenre;
  onRename: (genre: AdminGenre, name: string) => Promise<void>;
  onDelete: () => void;
}) {
  return (
    <article className="grid gap-3 rounded-panel border border-line bg-card p-4">
      <RenameField genre={genre} onRename={onRename} />
      <p className="text-sm text-muted">{genre.movieCount} phim</p>
      <DeleteGenre genre={genre} onDelete={onDelete} />
    </article>
  );
}

function RenameField({
  genre,
  onRename,
}: {
  genre: AdminGenre;
  onRename: (genre: AdminGenre, name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(genre.name);
  useEffect(() => setValue(genre.name), [genre.name]);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void onRename(genre, value);
      }}
    >
      <div className="min-w-0 flex-1">
        <Input
          label="Tên"
          name={`genre-${genre.id}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary">
        Lưu
      </Button>
    </form>
  );
}

function DeleteGenre({ genre, onDelete }: { genre: AdminGenre; onDelete: () => void }) {
  const used = genre.movieCount > 0;
  return (
    <Button
      variant="danger"
      disabled={used}
      title={used ? "Thể loại đang được dùng" : undefined}
      onClick={onDelete}
    >
      Xóa
    </Button>
  );
}
