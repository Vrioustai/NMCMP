"use client";

import type { BannedWord } from "@movie/contracts";
import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { errorMessage } from "../../lib/error-messages";
import { formatDate } from "../../lib/format";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { Input } from "../ui/input";

export function WordList() {
  const [words, setWords] = useState<BannedWord[] | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<BannedWord | null>(null);

  async function load() {
    setWords(await apiClient<BannedWord[]>("/admin/banned-words"));
  }

  useEffect(() => {
    void load().catch((caught) =>
      setMessage(caught instanceof ApiError ? caught.message : "Không tải được từ cấm."),
    );
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await apiClient("/admin/banned-words", { method: "POST", body: { word: draft } });
      setDraft("");
      await load();
    } catch (caught) {
      setMessage(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    }
  }

  async function remove(word: BannedWord) {
    setMessage("");
    setPending(null);
    try {
      await apiClient(`/admin/banned-words/${word.id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      setMessage(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Từ cấm</h1>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void create(event)}>
        <div className="min-w-0 flex-1">
          <Input
            label="Từ cấm"
            name="word"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit">Thêm</Button>
      </form>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      {words && words.length === 0 ? <EmptyState title="Chưa có từ cấm" /> : null}
      {words && words.length > 0 ? (
        <>
          <div className="grid gap-3 md:hidden">
            {words.map((word) => (
              <article
                key={word.id}
                className="grid gap-2 rounded-card border border-line bg-card p-3"
              >
                <p className="font-semibold">{word.word}</p>
                <p className="text-[13px] text-dim">Người thêm: {word.creator.displayName}</p>
                <p className="text-[13px] text-dim">Ngày thêm: {formatDate(word.createdAt)}</p>
                <Button variant="danger" onClick={() => setPending(word)}>
                  Xóa
                </Button>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-panel border border-line md:block">
            <table className="w-full text-left">
              <thead className="text-[13px] text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">Từ</th>
                  <th className="px-3 py-3 font-semibold">Người thêm</th>
                  <th className="px-3 py-3 font-semibold">Ngày thêm</th>
                  <th className="px-3 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id} className="border-t border-line text-sm">
                    <td className="px-3 py-3 font-semibold">{word.word}</td>
                    <td className="px-3 py-3">{word.creator.displayName}</td>
                    <td className="px-3 py-3">{formatDate(word.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Button variant="danger" onClick={() => setPending(word)}>
                        Xóa
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        title="Xóa từ cấm"
        message={pending ? `Xóa từ “${pending.word}”.` : ""}
        confirmLabel="Xóa"
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) void remove(pending);
        }}
      />
    </div>
  );
}
