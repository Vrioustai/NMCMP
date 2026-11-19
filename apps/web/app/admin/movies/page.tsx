import { Suspense } from "react";
import { MovieList } from "../../../components/admin/movie-list";

export const metadata = { title: "Phim" };

export default function AdminMoviesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Đang tải…</p>}>
      <MovieList />
    </Suspense>
  );
}
