import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

export function SearchBox({
  autoFocus = false,
  className = "",
}: {
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <form action="/search" className={`flex min-w-0 items-center gap-2 ${className}`}>
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Tìm theo tên phim</span>
        <Search
          size={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim"
        />
        <input
          name="q"
          placeholder="Tìm theo tên phim…"
          autoFocus={autoFocus}
          className="h-10 w-full rounded-control border border-line bg-raised pr-3 pl-10 text-base text-ink md:text-sm"
        />
      </label>
      <Link
        href="/search"
        aria-label="Mở bộ lọc"
        className="inline-flex size-10 items-center justify-center rounded-control bg-raised"
      >
        <SlidersHorizontal size={18} />
      </Link>
    </form>
  );
}
