import Link from "next/link";

export function pageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function MePager({
  base,
  page,
  pageSize,
  total,
}: {
  base: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex gap-2 text-sm" aria-label="Phân trang">
      {page > 1 ? (
        <Link className="rounded-control bg-raised px-3 py-2" href={`${base}?page=${page - 1}`}>
          Trước
        </Link>
      ) : null}
      {page < pages ? (
        <Link className="rounded-control bg-raised px-3 py-2" href={`${base}?page=${page + 1}`}>
          Sau
        </Link>
      ) : null}
    </nav>
  );
}
