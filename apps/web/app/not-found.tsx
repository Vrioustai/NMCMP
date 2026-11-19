import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center px-4">
      <h1 className="text-2xl font-extrabold">Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-muted">Đường dẫn này không có trên FilmGenZ.</p>
      <Link
        href="/"
        className="mt-5 inline-flex h-10 items-center rounded-control bg-accent px-4 font-semibold text-on-accent"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
