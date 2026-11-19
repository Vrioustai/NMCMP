import type { MovieCard } from "@movie/contracts";
import Link from "next/link";

export function DanmakuPromo({ movie }: { movie: MovieCard | null }) {
  const body = (
    <>
      <h2 className="text-xl font-extrabold">Không cô đơn… cùng Danmaku</h2>
      <p className="mt-1 text-sm text-muted">Bình luận chạy trên khung hình khi đang xem.</p>
    </>
  );
  if (!movie) {
    return <section className="rounded-card bg-card p-6">{body}</section>;
  }
  return (
    <Link href={`/movies/${movie.slug}`} className="block rounded-card bg-card p-6">
      {body}
    </Link>
  );
}
