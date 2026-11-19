"use client";

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label="Phân trang" className="flex items-center gap-2">
      <button
        type="button"
        className="h-10 rounded-control bg-raised px-3 text-sm disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Trước
      </button>
      <span className="text-[13px] text-muted">
        {page}/{pageCount}
      </span>
      <button
        type="button"
        className="h-10 rounded-control bg-raised px-3 text-sm disabled:opacity-50"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Sau
      </button>
    </nav>
  );
}
